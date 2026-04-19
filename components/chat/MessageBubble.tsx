'use client'
import { useState, useRef, useEffect } from 'react'
import { ThinkingBlock } from './ThinkingBlock'
import type { Message } from '@/types'

let markedInst: typeof import('marked').marked | null = null
async function getMarked() {
  if (markedInst) return markedInst
  const { marked } = await import('marked')
  marked.use({ breaks: true, gfm: true })
  markedInst = marked
  return marked
}
let purifyInst: typeof import('dompurify') | null = null
async function getPurify() {
  if (purifyInst) return purifyInst
  const DOMPurify = (await import('dompurify')).default as unknown as typeof import('dompurify')
  purifyInst = DOMPurify
  return DOMPurify
}
const HTML_ESC: Record<string, string> = { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }
function escHtml(s: string) { return String(s).replace(/[&<>"']/g, c => HTML_ESC[c]) }
function downloadCode(text: string, lang: string) {
  const extMap: Record<string, string> = { js:'js',javascript:'js',typescript:'ts',ts:'ts',python:'py',py:'py',html:'html',css:'css',json:'json',bash:'sh',sh:'sh' }
  const ext = extMap[lang?.toLowerCase()] || lang || 'txt'
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `aners_${Date.now()}.${ext}`; a.click()
  URL.revokeObjectURL(url)
}
export function MdContent({ raw, toolsMode = false }: { raw: string; toolsMode?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [html, setHtml] = useState('')
  useEffect(() => {
    if (!raw) return
    Promise.all([getMarked(), getPurify()]).then(([marked, DOMPurify]) => {
      const renderer = new marked.Renderer()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(renderer as any).code = (token: { text?: string; lang?: string }) => {
        const safeText = token.text ?? ''
        const escaped  = safeText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        const safeLang = token.lang ? escHtml(token.lang) : ''
        const langLabel = safeLang ? `<span class="code-lang">${safeLang}</span>` : ''
        const copyBtn  = `<button class="code-copy-btn" data-code="${encodeURIComponent(safeText)}">COPY</button>`
        const saveBtn  = toolsMode ? `<button class="code-dl-btn" data-lang="${safeLang||'txt'}" data-code="${encodeURIComponent(safeText)}">SAVE</button>` : ''
        return `<div class="code-block-wrap">${langLabel}<div class="code-btn-group">${copyBtn}${saveBtn}</div><pre><code class="language-${safeLang}">${escaped}</code></pre></div>`
      }
      const dirty = marked.parse(raw, { renderer }) as string
      const clean = (DOMPurify as unknown as { sanitize: (html: string, opts: object) => string }).sanitize(dirty, {
        ALLOWED_TAGS: ['p','br','strong','em','b','i','s','del','u','h1','h2','h3','h4','h5','h6','ul','ol','li','blockquote','hr','table','thead','tbody','tr','th','td','pre','code','span','div','a','button'],
        ALLOWED_ATTR: ['href','target','rel','class','data-lang','data-code','type'],
        FORCE_BODY: true,
      })
      setHtml(clean)
    })
  }, [raw, toolsMode])
  useEffect(() => {
    if (!ref.current) return
    const h = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      const dl   = t.closest<HTMLElement>('.code-dl-btn')
      const copy = t.closest<HTMLElement>('.code-copy-btn')
      if (dl)   downloadCode(decodeURIComponent(dl.dataset.code ?? ''), dl.dataset.lang ?? '')
      if (copy) {
        navigator.clipboard?.writeText(decodeURIComponent(copy.dataset.code ?? '')).catch(() => {})
        copy.textContent = 'COPIED'
        setTimeout(() => { copy.textContent = 'COPY' }, 1500)
      }
    }
    ref.current.addEventListener('click', h)
    return () => ref.current?.removeEventListener('click', h)
  }, [html])
  if (!html) return null
  return <div ref={ref} className="md-content" dangerouslySetInnerHTML={{ __html: html }} />
}
// parseThink dan MdContent di-export agar bisa dipakai di page.tsx
// BUG FIX: Sebelumnya cuma dipakai internal, sehingga chat page
// render plain text tanpa think blocks dan tanpa code highlighting
export function parseThink(content: string): { thinks: string[]; clean: string } {
  const thinks: string[] = []
  const clean = content.replace(/<think>([\s\S]*?)<\/think>/g, (_, t) => { thinks.push(t.trim()); return '' }).trim()
  return { thinks, clean }
}
interface MessageBubbleProps { message: Message; username?: string }
export function MessageBubble({ message: msg, username }: MessageBubbleProps) {
  if (msg.role === 'user') return (<div className="msg user"><div className="msg-role">{username ?? 'you'}</div><div className="msg-bubble">{msg.content}</div></div>)
  if (msg.role === 'system') return null
  if (msg.role === 'aria') {
    const { thinks, clean } = parseThink(msg.content)
    return (<div className="msg assistant"><div className="msg-role" style={{ color: '#FF5200' }}>aria</div><div className="msg-bubble">{thinks.map((t, i) => <ThinkingBlock key={i} content={t} />)}<MdContent raw={clean} toolsMode /></div></div>)
  }
  if (msg.role === 'nexus') {
    const { thinks, clean } = parseThink(msg.content)
    return (<div className="msg assistant" style={{ '--role-color': '#818cf8' } as React.CSSProperties}><div className="msg-role" style={{ color: '#818cf8' }}>nexus</div><div className="msg-bubble">{thinks.map((t, i) => <ThinkingBlock key={i} content={t} label="nexus thinking" />)}<MdContent raw={clean} /></div></div>)
  }
  const { thinks, clean } = parseThink(msg.content)
  return (<div className="msg assistant"><div className="msg-role">aria</div><div className="msg-bubble">{msg.thinking_raw && <ThinkingBlock content={msg.thinking_raw} label="reasoning" />}{thinks.map((t, i) => <ThinkingBlock key={i} content={t} />)}<MdContent raw={clean} toolsMode /></div></div>)
}
