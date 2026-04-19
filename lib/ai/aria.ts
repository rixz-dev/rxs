// lib/ai/aria.ts
// Aria agent — minimax-m2.7 via NVIDIA Build API
// Streaming dengan SSE, token-by-token

const NVIDIA_BASE  = 'https://integrate.api.nvidia.com/v1/chat/completions'
const ARIA_MODEL   = 'minimaxai/minimax-m2.7'

export interface AriaStreamOptions {
  messages:    Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  apiKey:      string
  temperature?: number
  topP?:        number
  maxTokens?:   number
  onToken:     (token: string) => void
}

export interface AriaResult {
  content:   string
  tokenUsage?: { prompt?: number; completion?: number; total?: number }
}

// ─── Stream Aria response, call onToken per delta, return full text ─
export async function streamAria(opts: AriaStreamOptions): Promise<AriaResult> {
  const {
    messages,
    apiKey,
    temperature = 0.7,
    topP        = 0.95,
    maxTokens   = 8192,
    onToken,
  } = opts

  const payload = {
    model:       ARIA_MODEL,
    messages,
    temperature,
    top_p:       topP,
    max_tokens:  maxTokens,
    stream:      true,
  }

  const res = await fetch(NVIDIA_BASE, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Aria API ${res.status}: ${errBody.slice(0, 300)}`)
  }

  const reader = res.body!.getReader()
  const dec    = new TextDecoder()
  let full = ''
  let buf  = ''
  let tokenUsage: AriaResult['tokenUsage']

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''

    for (const line of lines) {
      const t = line.trim()
      if (!t || t === 'data: [DONE]') continue
      if (t.startsWith('data: ')) {
        try {
          const j = JSON.parse(t.slice(6))
          const delta = j.choices?.[0]?.delta?.content ?? ''
          if (delta) {
            full += delta
            onToken(delta)
          }
          // Capture usage if provided (last chunk)
          if (j.usage) {
            tokenUsage = {
              prompt:     j.usage.prompt_tokens,
              completion: j.usage.completion_tokens,
              total:      j.usage.total_tokens,
            }
          }
        } catch {}
      }
    }
  }

  return { content: full, tokenUsage }
}
