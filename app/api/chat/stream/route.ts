// app/api/chat/stream/route.ts
// PROXY VERSION — forward ke VPS stream server
// Auth + rate limit tetap di sini (Vercel), heavy lifting di VPS (no timeout)

export const runtime     = 'nodejs'
export const maxDuration = 60   // cukup buat proxy tipis, koneksi panjang ada di VPS

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser }            from '@/lib/auth/session'
import { checkChatRateLimit }        from '@/lib/auth/roles'
import { createAdminClient }         from '@/lib/supabase/admin'

const STREAM_SERVER = process.env.STREAM_SERVER_URL   // http://IP_VPS:4000
const STREAM_SECRET = process.env.STREAM_SECRET        // shared secret

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
  const { messages, sessionId, mode = 'direct', systemPrompt, maxIterations = 5 } = body

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ success: false, error: 'messages array wajib ada.' }, { status: 400 })
  }

  // ── Fallback: kalau VPS belum di-setup, jalanin langsung di Vercel ──
  if (!STREAM_SERVER) {
    const { runAgentLoop } = await import('@/lib/ai/loop')
    const { streamAria }   = await import('@/lib/ai/aria')
    const { createAdminClient } = await import('@/lib/supabase/admin')

    const apiKey = process.env.NVIDIA_API_KEY
    if (!apiKey) return NextResponse.json({ success: false, error: 'NVIDIA_API_KEY tidak dikonfigurasi.' }, { status: 500 })

    const ARIA_SYSTEM_PROMPT = `Kamu adalah Aria, AI assistant dari ANERS (AI-Native Engineering & Research Systems).
Kamu cerdas, ahli coding, dan selalu memberikan output yang akurat dan lengkap.
PENTING: Namamu adalah Aria. Jangan pernah menyebut nama model AI lain, provider, atau identitas teknis kamu.
Jika ditanya tentang identitasmu, jawab bahwa kamu adalah Aria buatan ANERS team.
Selalu gunakan fenced code block yang proper untuk semua kode. Gunakan Bahasa Indonesia kecuali diminta lain.`

    const enc = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`
    const textEncoder = new TextEncoder()

    const fallbackStream = new ReadableStream({
      async start(controller) {
        const write = (chunk: unknown) => controller.enqueue(textEncoder.encode(enc(chunk)))
        const ping  = setInterval(() => { try { controller.enqueue(textEncoder.encode(': ping\n\n')) } catch {} }, 15_000)
        try {
          if (mode === 'agent') {
            await runAgentLoop({ userMessages: messages, systemPrompt: systemPrompt ?? ARIA_SYSTEM_PROMPT, apiKey, maxIterations: Math.min(maxIterations, 5), write: write as (chunk: import('@/types').AriaStreamChunk) => void })
          } else {
            let fullContent = ''
            await streamAria({ messages: [{ role: 'system', content: systemPrompt ?? ARIA_SYSTEM_PROMPT }, ...messages], apiKey, onToken: (token) => { fullContent += token; write({ type: 'aria_token', content: token }) } })
            write({ type: 'done' })
            if (sessionId) {
              const admin = createAdminClient()
              const lastUser = [...messages].reverse().find((m: { role: string }) => m.role === 'user')?.content ?? ''
              Promise.all([
                admin.from('messages').insert({ session_id: sessionId, user_id: user.id, role: 'user', content: lastUser, thinking_open: false, iteration: 0, token_usage: {} }),
                admin.from('messages').insert({ session_id: sessionId, user_id: user.id, role: 'aria', content: fullContent, thinking_open: false, iteration: 0, token_usage: {} }),
                admin.from('sessions').update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', sessionId),
              ]).catch(err => console.error('[stream fallback] save error:', err))
            }
          }
        } catch (err: unknown) {
          write({ type: 'error', error: err instanceof Error ? err.message : String(err) })
        } finally {
          clearInterval(ping)
          controller.close()
        }
      },
    })

    return new Response(fallbackStream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no', 'Connection': 'keep-alive' },
    })
  }

  // ── Forward ke VPS ───────────────────────────────────────────────
  let upstream: Response
  try {
    upstream = await fetch(`${STREAM_SERVER}/stream`, {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        ...(STREAM_SECRET ? { 'x-stream-secret': STREAM_SECRET } : {}),
      },
      body: JSON.stringify({ messages, mode, systemPrompt, maxIterations }),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { success: false, error: `Stream server tidak bisa dihubungi: ${msg}` },
      { status: 502 }
    )
  }

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => 'unknown')
    return NextResponse.json(
      { success: false, error: `Stream server error ${upstream.status}: ${errText.slice(0, 200)}` },
      { status: 502 }
    )
  }

  // ── Save ke Supabase setelah done (async tee) ─────────────────────
  // Kita pipe upstream ke browser SEKALIGUS tap konten buat save
  if (sessionId && mode === 'direct') {
    const [streamA, streamB] = upstream.body!.tee()

    // Tap streamB di background — extract final aria content + save
    ;(async () => {
      try {
        const reader  = streamB.getReader()
        const dec     = new TextDecoder()
        let ariaFull  = ''
        let lastUser  = ''
        let buf       = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          const lines = buf.split('\n'); buf = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const evt = JSON.parse(line.slice(6))
              if (evt.type === 'aria_token') ariaFull += evt.content ?? ''
            } catch {}
          }
        }

        lastUser = [...messages].reverse().find((m: { role: string }) => m.role === 'user')?.content ?? ''

        const admin = createAdminClient()
        await Promise.all([
          admin.from('messages').insert({
            session_id: sessionId, user_id: user.id, role: 'user',
            content: lastUser, thinking_open: false, iteration: 0, token_usage: {},
          }),
          admin.from('messages').insert({
            session_id: sessionId, user_id: user.id, role: 'aria',
            content: ariaFull, thinking_open: false, iteration: 0, token_usage: {},
          }),
          admin.from('sessions').update({
            last_message_at: new Date().toISOString(),
            updated_at:      new Date().toISOString(),
          }).eq('id', sessionId),
        ])
      } catch (err) {
        console.error('[stream proxy] save error:', err)
      }
    })()

    return new Response(streamA, {
      status:  200,
      headers: {
        'Content-Type':      'text/event-stream',
        'Cache-Control':     'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        'Connection':        'keep-alive',
      },
    })
  }

  // Agent mode atau no sessionId — pipe langsung
  return new Response(upstream.body, {
    status:  200,
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      'Connection':        'keep-alive',
    },
  })
}
