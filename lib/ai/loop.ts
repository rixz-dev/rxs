// lib/ai/loop.ts
// Aria ↔ Nexus orchestration loop
// Manages state, feeds Nexus verdict back to Aria, streams via SSE

import { streamAria }  from './aria'
import { streamNexus } from './nexus'
import type { AgentLoopState, AriaStreamChunk } from '@/types'

export const MAX_ITERATIONS = 5

export interface LoopOptions {
  userMessages:  Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  systemPrompt?: string
  apiKey:        string
  maxIterations?: number
  write: (chunk: AriaStreamChunk) => void
}

const ARIA_SYS_DEFAULT = `Kamu adalah Aria, AI assistant yang cerdas, cakap dalam coding, pembuatan file, dan tugas teknis.
Berikan output yang lengkap dan akurat. Selalu gunakan fenced code block yang proper untuk semua kode.
Jika ada feedback dari reviewer, perbaiki secara menyeluruh dan berikan output yang sudah diperbaiki secara lengkap.`

// FIX: trim conversation, keep sys prompt + last N pairs to avoid context blowup
function trimConversation(
  conv: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  keepPairs = 2
): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
  const sysMsg  = conv.filter(m => m.role === 'system')
  const nonSys  = conv.filter(m => m.role !== 'system')
  // 1 pair = 1 assistant + 1 user (feedback), +1 buat initial user msg
  const trimmed = nonSys.slice(-(keepPairs * 2 + 1))
  return [...sysMsg, ...trimmed]
}

export async function runAgentLoop(opts: LoopOptions): Promise<void> {
  const {
    userMessages,
    systemPrompt = ARIA_SYS_DEFAULT,
    apiKey,
    maxIterations = MAX_ITERATIONS,
    write,
  } = opts

  write({ type: 'iteration_start', iteration: 0 })

  let ariaConversation: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...userMessages,
  ]

  const state: AgentLoopState = {
    iteration:     0,
    maxIterations,
    ariaOutput:    '',
    nexusOutput:   '',
    nexusThinking: '',
    isComplete:    false,
  }

  const userTask = [...userMessages].reverse().find(m => m.role === 'user')?.content ?? ''

  for (let iter = 1; iter <= maxIterations; iter++) {
    state.iteration   = iter
    state.ariaOutput  = ''
    state.nexusOutput = ''

    write({ type: 'iteration_start', iteration: iter })

    // FIX: trim sebelum kirim ke Aria — cegah context blowup
    const trimmedConv = trimConversation(ariaConversation)

    // ── ARIA ───────────────────────────────────────────────────
    try {
      const ariaResult = await streamAria({
        messages: trimmedConv,
        apiKey,
        onToken: (token) => {
          state.ariaOutput += token
          write({ type: 'aria_token', content: token, iteration: iter })
        },
      })

      state.ariaOutput = ariaResult.content
      write({ type: 'aria_token', content: '', iteration: iter })

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      write({ type: 'error', error: `Aria error iter ${iter}: ${msg}` })
      return
    }

    // FIX: guard empty output — jangan terusin ke Nexus kalau Aria kosong
    if (!state.ariaOutput.trim()) {
      write({ type: 'error', error: `Aria returned empty output on iter ${iter}. Possible model field mismatch.` })
      return
    }

    // ── NEXUS ──────────────────────────────────────────────────
    let nexusVerdict: Awaited<ReturnType<typeof streamNexus>>

    try {
      nexusVerdict = await streamNexus({
        userTask,
        ariaOutput: state.ariaOutput,
        iteration:  iter,
        apiKey,
        onToken: (token) => {
          state.nexusOutput += token
          write({ type: 'nexus_thinking', content: token, iteration: iter })
        },
      })
    } catch (err: unknown) {
      // Nexus error → gracefully approve, deliver Aria output
      write({ type: 'iteration_end', iteration: iter })
      write({ type: 'done' })
      return
    }

    state.nexusOutput   = nexusVerdict.cleanOutput
    state.nexusThinking = nexusVerdict.thinking

    write({
      type:      'nexus_token',
      content:   JSON.stringify({
        thinking: nexusVerdict.thinking,
        output:   nexusVerdict.cleanOutput,
        verdict:  nexusVerdict.verdict,
        notes:    nexusVerdict.notes,
      }),
      iteration: iter,
    })

    write({ type: 'iteration_end', iteration: iter })

    if (nexusVerdict.verdict === 'approved') {
      state.isComplete = true
      write({ type: 'done' })
      return
    }

    // FIX: spread ke trimmedConv, bukan full ariaConversation
    ariaConversation = [
      ...trimmedConv,
      { role: 'assistant', content: state.ariaOutput },
      {
        role: 'user',
        content: `Reviewer memberikan feedback:\n${nexusVerdict.notes || nexusVerdict.cleanOutput}\n\nPerbaiki output kamu berdasarkan feedback ini. Berikan output yang sudah diperbaiki secara lengkap.`,
      },
    ]

    if (iter === maxIterations) {
      state.isComplete = true
      write({ type: 'done' })
      return
    }
  }

  write({ type: 'done' })
}
