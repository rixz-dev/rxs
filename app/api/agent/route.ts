export const runtime = 'nodejs'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1/chat/completions'
const ARIA_MODEL  = 'minimaxai/minimax-m2.7'
const NEXUS_MODEL = 'deepseek-ai/deepseek-v3.2'
const MAX_ITER    = 5

function enc(obj: Record<string, unknown>): string {
  return `data: ${JSON.stringify(obj)}\n\n`
}

function parseVerdict(text: string): { verdict: 'approved' | 'fix'; notes: string } {
  const jsonMatch = text.match(/\{[\s\S]*?"verdict"[\s\S]*?\}/g)
  if (jsonMatch) {
    try {
      const last = JSON.parse(jsonMatch[jsonMatch.length - 1])
      if (last.verdict === 'approved' || last.verdict === 'fix') {
        return { verdict: last.verdict, notes: last.notes ?? '' }
      }
    } catch {}
  }
  const lower = text.toLowerCase()
  const fixKw = ['fix','error','bug','issue','problem','incorrect','wrong','missing','perbaiki','salah']
  const okKw  = ['approved','looks good','correct','perfect','bagus','ok','done','selesai','valid']
  for (const kw of okKw)  if (lower.includes(kw)) return { verdict: 'approved', notes: '' }
  for (const kw of fixKw) if (lower.includes(kw)) return { verdict: 'fix', notes: text.slice(0, 300) }
  return { verdict: 'approved', notes: '' }
}

function parseThink(raw: string): { thinking: string; clean: string } {
  const parts: string[] = []
  const clean = raw.replace(/<think>([\s\S]*?)<\/think>/g, (_: string, t: string) => { parts.push(t.trim()); return '' }).trim()
  return { thinking: parts.join('\n\n'), clean }
}

interface StreamOptions {
  model: string
  messages: Array<{ role: string; content: string }>
  extraParams?: Record<string, unknown>
  key: string
  onToken: (t: string) => void
}

async function streamNvidia({ model, messages, extraParams = {}, key, onToken }: StreamOptions): Promise<string> {
  const payload = { model, messages, temperature: 0.7, top_p: 0.95, max_tokens: 8192, stream: true, ...extraParams }
  const res = await fetch(NVIDIA_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`NVIDIA ${res.status}: ${(await res.text()).slice(0, 200)}`)

  const reader = res.body!.getReader()
  const dec = new TextDecoder()
  let full = '', buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n'); buf = lines.pop() ?? ''
    for (const line of lines) {
      const t = line.trim()
      if (!t || t === 'data: [DONE]') continue
      if (t.startsWith('data: ')) {
        try { const j = JSON.parse(t.slice(6)); const d = j.choices?.[0]?.delta?.content ?? ''; if (d) { full += d; onToken(d) } } catch {}
      }
    }
  }
  return full
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { messages, apiKey, maxIterations = MAX_ITER, systemPrompt } = body
  const key = apiKey?.trim() || process.env.NVIDIA_API_KEY
  if (!key) return new Response(JSON.stringify({ error: 'No API key.' }), { status: 401 })
  if (!Array.isArray(messages) || messages.length === 0) return new Response(JSON.stringify({ error: 'messages required' }), { status: 400 })

  const encoder = new TextEncoder()
  const maxIter = Math.min(maxIterations, MAX_ITER)

  const stream = new ReadableStream({
    async start(controller) {
      const push = (obj: Record<string, unknown>) => controller.enqueue(encoder.encode(enc(obj)))
      try {
        push({ type: 'start', maxIterations: maxIter })
        const ariaSys = systemPrompt || 'Kamu adalah Aria, AI assistant yang membantu coding dan tugas teknis.'
        const nexusSys = `Kamu adalah Nexus, AI reviewer. Evaluasi output Aria.\nOutput JSON di baris terakhir:\n{"verdict":"approved"|"fix","notes":"..."}`
        let ariaMessages: Array<{ role: string; content: string }> = [{ role: 'system', content: ariaSys }, ...messages]
        let ariaOutput = ''
        const userTask: string = [...messages].reverse().find((m: { role: string }) => m.role === 'user')?.content ?? ''

        for (let iter = 1; iter <= maxIter; iter++) {
          push({ type: 'iter', iteration: iter })
          ariaOutput = ''
          try {
            ariaOutput = await streamNvidia({ model: ARIA_MODEL, messages: ariaMessages, key, onToken: (t) => push({ type: 'aria_token', content: t, iteration: iter }) })
          } catch (err: unknown) {
            push({ type: 'error', error: `Aria error: ${err instanceof Error ? err.message : String(err)}` }); break
          }
          push({ type: 'aria_done', iteration: iter, content: ariaOutput })

          let nexusRaw = ''
          try {
            nexusRaw = await streamNvidia({
              model: NEXUS_MODEL,
              messages: [{ role: 'system', content: nexusSys }, { role: 'user', content: `Task: ${userTask}\n\nAria output iter ${iter}:\n${ariaOutput}\n\nBerikan verdict JSON.` }],
              extraParams: { temperature: 1, top_p: 0.95, max_tokens: 4096, chat_template_kwargs: { thinking: true } },
              key,
              onToken: (t) => push({ type: 'nexus_token', content: t, iteration: iter }),
            })
          } catch { push({ type: 'final', content: ariaOutput, iterations: iter }); push({ type: 'done' }); controller.close(); return }

          const { thinking, clean } = parseThink(nexusRaw)
          const { verdict, notes } = parseVerdict(nexusRaw)
          push({ type: 'nexus_done', iteration: iter, thinking, output: clean, verdict, notes })

          if (verdict === 'approved' || iter === maxIter) { push({ type: 'final', content: ariaOutput, iterations: iter }); push({ type: 'done' }); controller.close(); return }
          ariaMessages = [...ariaMessages, { role: 'assistant', content: ariaOutput }, { role: 'user', content: `Feedback Nexus:\n${notes || clean}\n\nPerbaiki output kamu secara lengkap.` }]
        }
        push({ type: 'done' }); controller.close()
      } catch (err: unknown) {
        push({ type: 'error', error: err instanceof Error ? err.message : String(err) }); controller.close()
      }
    },
  })

  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } })
}
