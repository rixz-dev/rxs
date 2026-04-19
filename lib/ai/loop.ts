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
  // SSE writer — caller provides this
  write: (chunk: AriaStreamChunk) => void
}

const ARIA_SYS_DEFAULT = `Kamu adalah Aria, AI assistant yang cerdas, cakap dalam coding, pembuatan file, dan tugas teknis.
Berikan output yang lengkap dan akurat. Selalu gunakan fenced code block yang proper untuk semua kode.
Jika ada feedback dari reviewer, perbaiki secara menyeluruh dan berikan output yang sudah diperbaiki secara lengkap.`

export async function runAgentLoop(opts: LoopOptions): Promise<void> {
  const {
    userMessages,
    systemPrompt = ARIA_SYS_DEFAULT,
    apiKey,
    maxIterations = MAX_ITERATIONS,
    write,
  } = opts

  write({ type: 'iteration_start', iteration: 0 })

  // Build Aria conversation — start fresh
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

  // Get user's task from last user message
  const userTask = [...userMessages].reverse().find(m => m.role === 'user')?.content ?? ''

  for (let iter = 1; iter <= maxIterations; iter++) {
    state.iteration  = iter
    state.ariaOutput = ''
    state.nexusOutput = ''

    write({ type: 'iteration_start', iteration: iter })

    // ── ARIA ───────────────────────────────────────────────────
    try {
      const ariaResult = await streamAria({
        messages:  ariaConversation,
        apiKey,
        onToken: (token) => {
          state.ariaOutput += token
          write({ type: 'aria_token', content: token, iteration: iter })
        },
      })

      state.ariaOutput = ariaResult.content
      write({ type: 'aria_token', content: '', iteration: iter }) // signal done

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      write({ type: 'error', error: `Aria error iter ${iter}: ${msg}` })
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
          state.nexusOutput   += token
          state.nexusThinking += '' // parsed later
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
      type:     'nexus_token',
      content:  JSON.stringify({
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

    // verdict === 'fix' → add feedback to Aria conversation and continue
    ariaConversation = [
      ...ariaConversation,
      { role: 'assistant', content: state.ariaOutput },
      {
        role: 'user',
        content: `Reviewer memberikan feedback:\n${nexusVerdict.notes || nexusVerdict.cleanOutput}\n\nPerbaiki output kamu berdasarkan feedback ini. Berikan output yang sudah diperbaiki secara lengkap.`,
      },
    ]

    // Last iteration — output regardless
    if (iter === maxIterations) {
      state.isComplete = true
      write({ type: 'done' })
      return
    }
  }

  write({ type: 'done' })
}
