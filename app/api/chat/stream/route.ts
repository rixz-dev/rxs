// app/api/chat/stream/route.ts
// Dual-agent SSE streaming endpoint
// Supports: mode=agent (Aria↔Nexus loop) | mode=direct (single Aria call)

export const runtime    = 'nodejs'
export const maxDuration = 120

import { NextRequest, NextResponse }  from 'next/server'
import { getCurrentUser }             from '@/lib/auth/session'
import { checkChatRateLimit }         from '@/lib/auth/roles'
import { createAdminClient }          from '@/lib/supabase/admin'
import { runAgentLoop }               from '@/lib/ai/loop'
import { streamAria }                 from '@/lib/ai/aria'
import type { AriaStreamChunk }       from '@/types'

function enc(obj: AriaStreamChunk): string {
  return `data: ${JSON.stringify(obj)}\n\n`
}

export async function POST(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 })
  }

  if (user.status === 'banned') {
    return NextResponse.json({ success: false, error: 'Akun kamu dibanned.' }, { status: 403 })
  }

  // ── Rate limit ───────────────────────────────────────────────────
  const rateResult = await checkChatRateLimit(user.id, user.role)
  if (!rateResult.allowed) {
    return NextResponse.json(
      { success: false, error: rateResult.reason, resetIn: rateResult.resetIn },
      { status: 429 }
    )
  }

  // ── Parse body ───────────────────────────────────────────────────
  const body = await req.json()
  const {
    messages,
    sessionId,
    mode = 'direct',     // 'direct' | 'agent'
    systemPrompt,
    maxIterations = 5,
  } = body

  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'NVIDIA_API_KEY tidak dikonfigurasi di server.' },
      { status: 500 }
    )
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ success: false, error: 'messages array wajib ada.' }, { status: 400 })
  }

// ── Stream ───────────────────────────────────────────────────────
  // BUG FIX: Tanpa system prompt default, model jatuh ke identitas aslinya
  // (MiniMax, DeepSeek, dll). Selalu inject Aria persona.
  const ARIA_SYSTEM_PROMPT = `Kamu adalah Aria, AI assistant dari ANERS (AI-Native Engineering & Research Systems).
Kamu cerdas, ahli coding, dan selalu memberikan output yang akurat dan lengkap.
PENTING: Namamu adalah Aria. Jangan pernah menyebut nama model AI lain, provider, atau identitas teknis kamu.
Jika ditanya tentang identitasmu, jawab bahwa kamu adalah Aria buatan ANERS team.
Selalu gunakan fenced code block yang proper untuk semua kode. Gunakan Bahasa Indonesia kecuali diminta lain.`

  const textEncoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const write = (chunk: AriaStreamChunk) => {
        controller.enqueue(textEncoder.encode(enc(chunk)))
      }

      try {
        if (mode === 'agent') {
          // ── Agent loop mode ───────────────────────────────────
          await runAgentLoop({
            userMessages:  messages,
            systemPrompt:  systemPrompt ?? ARIA_SYSTEM_PROMPT,
            apiKey,
            maxIterations: Math.min(maxIterations, 5),
            write,
          })
        } else {
          // ── Direct single-Aria mode ───────────────────────────
          // BUG FIX: Pakai default system prompt kalau client ga kirim
          const effectiveSys = systemPrompt ?? ARIA_SYSTEM_PROMPT
          const sysMsg = [{ role: 'system' as const, content: effectiveSys }]

          let fullContent = ''

          await streamAria({
            messages: [...sysMsg, ...messages],
            apiKey,
            onToken: (token) => {
              fullContent += token
              write({ type: 'aria_token', content: token })
            },
          })

          write({ type: 'done' })

          // ── Save message to Supabase (async, non-blocking) ─────
          if (sessionId) {
            const admin = createAdminClient()
            const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
            Promise.all([
              admin.from('messages').insert({
                session_id:    sessionId,
                user_id:       user.id,
                role:          'user',
                content:       lastUserMsg?.content ?? '',
                thinking_open: false,
                iteration:     0,
                token_usage:   {},
              }),
              admin.from('messages').insert({
                session_id:    sessionId,
                user_id:       user.id,
                role:          'aria',
                content:       fullContent,
                thinking_open: false,
                iteration:     0,
                token_usage:   {},
              }),
              admin.from('sessions')
                .update({
                  last_message_at: new Date().toISOString(),
                  updated_at:      new Date().toISOString(),
                })
                .eq('id', sessionId),
            ]).catch((err) => console.error('[stream] save error:', err))
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        write({ type: 'error', error: msg })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'Connection':        'keep-alive',
    },
  })
}
