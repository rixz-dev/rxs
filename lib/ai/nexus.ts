// lib/ai/nexus.ts
// Nexus critic — deepseek-v3.2 via NVIDIA Build API
// thinking: true → hasilnya ada <think>...</think> block

const NVIDIA_BASE  = 'https://integrate.api.nvidia.com/v1/chat/completions'
const NEXUS_MODEL  = 'deepseek-ai/deepseek-v3.2'

export interface NexusStreamOptions {
  userTask:   string         // task asli dari user
  ariaOutput: string         // output Aria yang mau dikritik
  iteration:  number
  apiKey:     string
  onToken:    (token: string) => void
}

export interface NexusVerdict {
  verdict:       'approved' | 'fix'
  notes:         string
  thinking:      string    // parsed dari <think>...</think>
  cleanOutput:   string    // output tanpa think block
  rawOutput:     string    // full raw (dengan think tags)
}

const NEXUS_SYS = `Kamu adalah Nexus, AI reviewer kritis dari ANERS team.
Tugasmu adalah mengevaluasi output dari Aria AI assistant dan menentukan apakah sudah benar dan lengkap.
PENTING: Namamu adalah Nexus. Jangan pernah menyebut identitas model AI sesungguhnya atau provider.

Evaluasi berdasarkan:
- Kebenaran teknis (kode, logika, konsep)
- Kelengkapan output (tidak terpotong, semua diminta ada)
- Kualitas kode (tidak ada bug nyata, pattern yang benar)
- Kesesuaian dengan yang diminta user

Setelah analisa, OUTPUT JSON di baris terakhir TANPA markdown wrapper:
{"verdict":"approved","notes":"penjelasan singkat"}

ATAU:
{"verdict":"fix","notes":"jelaskan spesifik apa yang harus diperbaiki Aria"}

Verdict harus SATU dari: "approved" atau "fix". Tidak ada yang lain.`

// ─── Parse <think>...</think> dari raw output ─────────────────────
export function parseNexusThinking(raw: string): { thinking: string; clean: string } {
  const parts: string[] = []
  let clean = raw
  const re = /<think>([\s\S]*?)<\/think>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) parts.push(m[1].trim())
  clean = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  return { thinking: parts.join('\n\n'), clean }
}

// ─── Parse verdict JSON dari output Nexus ─────────────────────────
export function parseNexusVerdict(text: string): Pick<NexusVerdict, 'verdict' | 'notes'> {
  // Coba parse JSON block — support nested think
  const jsonMatches = text.match(/\{[\s\S]*?"verdict"[\s\S]*?\}/g)
  if (jsonMatches) {
    for (let i = jsonMatches.length - 1; i >= 0; i--) {
      try {
        const parsed = JSON.parse(jsonMatches[i])
        if (parsed.verdict === 'approved' || parsed.verdict === 'fix') {
          return { verdict: parsed.verdict, notes: String(parsed.notes ?? '') }
        }
      } catch {}
    }
  }

  // Fallback: keyword detection di clean text
  const lower = text.toLowerCase()

  const approveKw = ['approved', 'looks good', 'correct', 'perfect', 'well done', 'no issues',
                     'bagus', 'benar', 'oke', 'selesai', 'sempurna', 'valid', 'complete']
  const fixKw     = ['fix', 'error', 'bug', 'issue', 'problem', 'incorrect', 'wrong', 'missing',
                     'perbaiki', 'salah', 'kurang', 'gagal', 'crash', 'undefined', 'broken']

  for (const kw of approveKw) if (lower.includes(kw)) return { verdict: 'approved', notes: '' }
  for (const kw of fixKw)     if (lower.includes(kw)) return { verdict: 'fix', notes: text.slice(0, 400) }

  // Default approve — jangan block kalau Nexus ga jelas
  return { verdict: 'approved', notes: '' }
}

// ─── Stream Nexus evaluation ──────────────────────────────────────
export async function streamNexus(opts: NexusStreamOptions): Promise<NexusVerdict> {
  const { userTask, ariaOutput, iteration, apiKey, onToken } = opts

  const userPrompt = `Task yang diminta user:
${userTask}

Output dari Aria (iterasi ${iteration}):
${ariaOutput}

Evaluasi output Aria. Berikan verdict JSON di baris terakhir.`

  const payload = {
    model:   NEXUS_MODEL,
    messages: [
      { role: 'system', content: NEXUS_SYS },
      { role: 'user',   content: userPrompt },
    ],
    temperature: 1,
    top_p:       0.95,
    max_tokens:  4096,
    stream:      true,
    chat_template_kwargs: { thinking: true },
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
    throw new Error(`Nexus API ${res.status}: ${errBody.slice(0, 300)}`)
  }

  const reader = res.body!.getReader()
  const dec    = new TextDecoder()
  let raw = ''
  let buf = ''

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
            raw += delta
            onToken(delta)
          }
        } catch {}
      }
    }
  }

  const { thinking, clean } = parseNexusThinking(raw)
  const { verdict, notes }  = parseNexusVerdict(raw)

  return {
    verdict,
    notes,
    thinking,
    cleanOutput: clean,
    rawOutput:   raw,
  }
}
