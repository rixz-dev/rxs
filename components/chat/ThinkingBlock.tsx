'use client'
// components/chat/ThinkingBlock.tsx
// Collapsible thinking/reasoning block

import { useState } from 'react'

interface ThinkingBlockProps {
  content:  string
  label?:   string
  defaultOpen?: boolean
}

export function ThinkingBlock({ content, label = 'reasoning chain', defaultOpen = false }: ThinkingBlockProps) {
  const [open, setOpen] = useState(defaultOpen)

  if (!content) return null

  const tokenEst = Math.round(content.length / 3.5)

  return (
    <div className="think-wrap">
      <button
        className="think-toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="think-arrow">{open ? '▼' : '▶'}</span>
        <span className="think-label">{label}</span>
        <span className="think-meta">~{tokenEst} tokens</span>
      </button>
      {open && (
        <div className="think-body" role="region">
          {content}
        </div>
      )}
    </div>
  )
}
