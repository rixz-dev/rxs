'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ThinkingBlock } from '@/components/chat/ThinkingBlock'
// FIX #4 #5: Import MdContent + parseThink yang sekarang sudah di-export dari MessageBubble
import { MdContent, parseThink } from '@/components/chat/MessageBubble'

interface AgentIteration {
  iteration: number; ariaContent: string; ariaStreaming: boolean
  nexusContent: string; nexusThinking: string; nexusStreaming: boolean
  verdict: 'approved' | 'fix' | null; notes: string
}
interface ChatMessage {
  id: string; role: 'user' | 'aria' | 'agent' | 'error'
  content: string; agentIters?: AgentIteration[]; iterations?: number
}
interface SessionItem { id: string; title: string; last_message_at: string }
interface ApiKeyItem { id: string; key_prefix: string; status: string; created_at: string; total_requests: number; total_tokens: number }
interface ProfileData { username: string; role: string; email?: string; chat_count_today: number }

const TEXT_EXT = /\.(js|ts|jsx|tsx|py|php|go|rb|java|c|cpp|cs|css|html|json|xml|yaml|md|txt|sh|sql|env)$/i

const IC = {
  Send:    () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>,
  Loader:  () => <svg className="spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 11-6.219-8.56" strokeLinecap="round"/></svg>,
  Attach:  () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>,
  Agent:   () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  Menu:    () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  Plus:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Close:   () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Back:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M5 12l7-7M5 12l7 7"/></svg>,
  Logout:  () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
  User:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  History: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Key:     () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
  Docs:    () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  Token:   () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  Copy:    () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
  Trash:   () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  Edit:    () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Refresh: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>,
  Zap:     () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  File:    () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  ExtLink: () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
}

const ROLE_COLOR: Record<string, string> = { free: '#64748b', pro: '#3b82f6', max: '#FF5200', admin: '#a855f7' }

function updateIter(list: AgentIteration[], u: AgentIteration) { return list.map(i => i.iteration === u.iteration ? u : i) }

// ─── FIX #4 #5: Aria message bubble — parse think + markdown ─────
function AriaBubble({ content }: { content: string }) {
  const { thinks, clean } = parseThink(content)
  return (
    <>
      {thinks.map((t, i) => <ThinkingBlock key={i} content={t} label="aria thinking" />)}
      {clean && <MdContent raw={clean} toolsMode />}
    </>
  )
}

// Streaming: handle partial <think> yang belum tertutup
function StreamingBubble({ content }: { content: string }) {
  const thinkStart = content.indexOf('<think>')
  const thinkEnd   = content.lastIndexOf('</think>')

  if (thinkStart !== -1 && thinkEnd !== -1) {
    // Think block sudah komplit — parse dan render
    const { thinks, clean } = parseThink(content)
    return (
      <>
        {thinks.map((t, i) => <ThinkingBlock key={i} content={t} label="aria thinking" />)}
        <span style={{ whiteSpace: 'pre-wrap' }}>{clean}</span>
        <span className="cursor-blink" />
      </>
    )
  }
  if (thinkStart !== -1 && thinkEnd === -1) {
    // Think block masih streaming (belum ada </think>)
    const before   = content.slice(0, thinkStart)
    const thinking = content.slice(thinkStart + 7)
    return (
      <>
        {before && <span style={{ whiteSpace: 'pre-wrap' }}>{before}</span>}
        <ThinkingBlock content={thinking} label="aria thinking" defaultOpen />
      </>
    )
  }
  // Plain streaming tanpa think
  return <><span style={{ whiteSpace: 'pre-wrap' }}>{content}</span><span className="cursor-blink" /></>
}

// ─── Agent iteration block ────────────────────────────────────────
function AgentIterBlock({ iter }: { iter: AgentIteration }) {
  const [ao, setAo] = useState(true)
  const [no, setNo] = useState(false)
  const vc = iter.verdict === 'approved' ? '#22c55e' : iter.verdict === 'fix' ? '#f97316' : '#888'
  const vl = iter.verdict === 'approved' ? '✓ APPROVED' : iter.verdict === 'fix' ? '⚠ FIX' : '· EVALUATING'
  return (
    <div className="agent-iter-block">
      <div className="agent-iter-header">
        <span className="agent-iter-label">Iteration {iter.iteration}</span>
        {iter.verdict && <span className="agent-iter-verdict" style={{ color: vc }}>{vl}</span>}
      </div>
      <div className="agent-sub-block">
        <button className="agent-sub-toggle" onClick={() => setAo(o => !o)}>
          <span style={{ color: '#FF5200' }}>▸ ARIA</span>
          <span className="agent-sub-arrow">{ao ? '▼' : '▶'}</span>
        </button>
        {ao && <div className="agent-sub-body">
          {/* FIX: Aria content in agent mode pakai AriaBubble + MdContent */}
          {iter.ariaContent
            ? <AriaBubble content={iter.ariaContent} />
            : <span className="cursor-blink" />
          }
          {iter.ariaStreaming && iter.ariaContent && <span className="cursor-blink" />}
        </div>}
      </div>
      {(iter.nexusContent || iter.nexusStreaming) && (
        <div className="agent-sub-block">
          <button className="agent-sub-toggle" onClick={() => setNo(o => !o)}>
            <span style={{ color: '#818cf8' }}>▸ NEXUS</span>
            <span className="agent-sub-arrow">{no ? '▼' : '▶'}</span>
          </button>
          {no && <div className="agent-sub-body">
            {iter.nexusThinking && <ThinkingBlock content={iter.nexusThinking} label="nexus thinking" />}
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', margin: 0 }}>{iter.nexusContent}</pre>
            {iter.nexusStreaming && <span className="cursor-blink" />}
            {iter.notes && <div className="agent-notes"><span style={{ color: '#f97316' }}>Notes: </span>{iter.notes}</div>}
          </div>}
        </div>
      )}
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────
// FIX #1: Panel 'profile' dihapus → sekarang jadi page /profile tersendiri
type Panel = 'menu' | 'history' | 'apikeys' | 'tokens'

function sessBtnStyle(active: boolean): React.CSSProperties {
  return { display: 'block', width: '100%', textAlign: 'left', background: active ? '#1a1a1a' : 'none', border: 'none', borderLeft: `2px solid ${active ? '#FF5200' : 'transparent'}`, color: active ? '#fff' : '#888', padding: '10px 14px', cursor: 'pointer', fontSize: '12px', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
}
function badgeStyle(role: string): React.CSSProperties {
  return { display: 'inline-block', background: `${ROLE_COLOR[role] ?? '#555'}22`, color: ROLE_COLOR[role] ?? '#555', border: `1px solid ${ROLE_COLOR[role] ?? '#555'}44`, fontSize: '10px', padding: '2px 8px', letterSpacing: '0.1em', fontWeight: 700 }
}

function SidebarContent({ panel, setPanel, sessionId, profile, sessions, apiKeys, onNewChat, onLoadSession, onLogout, onGenerateKey, onRevokeKey }: {
  panel: Panel; setPanel: (p: Panel) => void; sessionId: string
  profile: ProfileData | null; sessions: SessionItem[]; apiKeys: ApiKeyItem[]
  onNewChat: () => void; onLoadSession: (id: string) => void; onLogout: () => void
  onGenerateKey: () => void; onRevokeKey: (id: string) => void
}) {
  const [copiedKey, setCopiedKey] = useState('')
  const router = useRouter()

  const copyText = (text: string, id: string) => {
    navigator.clipboard?.writeText(text).catch(() => {})
    setCopiedKey(id); setTimeout(() => setCopiedKey(''), 1500)
  }

  const S: Record<string, React.CSSProperties> = {
    hdr:     { display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 16px', borderBottom: '1px solid #1a1a1a', color: '#888', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' as const },
    row:     { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer', color: '#aaa', fontSize: '13px', borderBottom: '1px solid #111', background: 'none', border: 'none', width: '100%', textAlign: 'left' as const },
    label:   { color: '#555', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, padding: '12px 16px 6px' },
    val:     { color: '#e0e0e0', fontSize: '13px', padding: '0 16px 12px' },
    keycard: { background: '#111', border: '1px solid #1e1e1e', margin: '0 12px 8px', padding: '10px 12px' },
    stat:    { background: '#111', border: '1px solid #1e1e1e', margin: '0 12px 8px', padding: '12px', display: 'flex', flexDirection: 'column' as const, gap: '4px' },
  }

  if (panel === 'menu') return (
    <>
      <div style={S.hdr}>ANERS</div>
      <button style={{ ...S.row, marginTop: '4px' }} onClick={onNewChat}><IC.Plus /><span>New Chat</span></button>
      {/* FIX #1: Profile → page /profile, bukan sub-panel yang lambat */}
      <button style={S.row} onClick={() => router.push('/profile')}>
        <IC.User /><span>Profile &amp; Settings</span>
        {profile && <span style={{ marginLeft: 'auto', ...badgeStyle(profile.role) }}>{profile.role.toUpperCase()}</span>}
      </button>
      <button style={S.row} onClick={() => setPanel('history')}><IC.History /><span>Chat History</span></button>
      <button style={S.row} onClick={() => setPanel('apikeys')}><IC.Key /><span>API Keys</span></button>
      <button style={S.row} onClick={() => setPanel('tokens')}><IC.Token /><span>Token Monitor</span></button>
      <a href="/docs" style={{ ...S.row, textDecoration: 'none' }} target="_blank" rel="noopener noreferrer"><IC.Docs /><span>API Docs</span></a>
      <div style={{ flex: 1 }} />
      <button style={{ ...S.row, color: '#ef4444', borderTop: '1px solid #1a1a1a' }} onClick={onLogout}><IC.Logout /><span>Logout</span></button>
    </>
  )

  if (panel === 'history') return (
    <>
      <div style={S.hdr}><button onClick={() => setPanel('menu')} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: 0 }}><IC.Back /></button>Chat History</div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {sessions.length === 0 && <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '24px' }}>Belum ada history</p>}
        {sessions.map(s => (
          <button key={s.id} style={sessBtnStyle(s.id === sessionId)} onClick={() => onLoadSession(s.id)}>
            <div style={{ fontWeight: 600, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
            <div style={{ color: '#444', fontSize: '10px' }}>{new Date(s.last_message_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
          </button>
        ))}
      </div>
    </>
  )

  if (panel === 'apikeys') return (
    <>
      <div style={S.hdr}><button onClick={() => setPanel('menu')} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: 0 }}><IC.Back /></button>API Keys</div>
      <div style={{ padding: '12px' }}>
        <button onClick={onGenerateKey} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,82,0,0.08)', border: '1px solid rgba(255,82,0,0.2)', color: '#FF5200', padding: '10px 14px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, marginBottom: '12px' }}><IC.Plus /> Generate New Key</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {apiKeys.length === 0 && <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '24px' }}>Belum ada API key</p>}
        {apiKeys.map(k => (
          <div key={k.id} style={S.keycard}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <code style={{ color: '#FF5200', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}>{k.key_prefix}...</code>
              <span style={{ color: k.status === 'active' ? '#22c55e' : '#ef4444', fontSize: '10px', fontWeight: 700 }}>{k.status.toUpperCase()}</span>
            </div>
            <div style={{ color: '#555', fontSize: '10px', marginBottom: '8px' }}>
              Requests: {k.total_requests} · Tokens: {k.total_tokens.toLocaleString()} · {new Date(k.created_at).toLocaleDateString('id-ID')}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => copyText(k.key_prefix, k.id)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: 'none', border: '1px solid #2a2a2a', color: '#888', padding: '5px', cursor: 'pointer', fontSize: '11px' }}><IC.Copy />{copiedKey === k.id ? 'COPIED' : 'COPY'}</button>
              {k.status === 'active' && <button onClick={() => onRevokeKey(k.id)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '5px', cursor: 'pointer', fontSize: '11px' }}><IC.Trash />REVOKE</button>}
            </div>
          </div>
        ))}
      </div>
    </>
  )

  if (panel === 'tokens') return (
    <>
      <div style={S.hdr}><button onClick={() => setPanel('menu')} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: 0 }}><IC.Back /></button>Token Monitor</div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {apiKeys.length === 0
          ? <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '24px' }}>Belum ada data token</p>
          : apiKeys.map(k => (
            <div key={k.id} style={S.stat}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <code style={{ color: '#FF5200', fontSize: '11px' }}>{k.key_prefix}...</code>
                <span style={{ color: k.status === 'active' ? '#22c55e' : '#ef4444', fontSize: '10px' }}>{k.status}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                {[['Total Tokens', k.total_tokens.toLocaleString()], ['Total Requests', k.total_requests.toString()]].map(([label, val]) => (
                  <div key={label} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: '8px' }}>
                    <div style={{ color: '#444', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>{label}</div>
                    <div style={{ color: '#FF5200', fontSize: '16px', fontWeight: 900, fontFamily: 'JetBrains Mono, monospace' }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          ))
        }
        {profile && (
          <div style={{ ...S.stat, margin: '0 12px' }}>
            <div style={{ color: '#555', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: '8px' }}>Session Today</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[['Chat Count', profile.chat_count_today.toString()], ['Role', profile.role.toUpperCase()]].map(([label, val]) => (
                <div key={label} style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', padding: '8px' }}>
                  <div style={{ color: '#444', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>{label}</div>
                  <div style={{ color: '#e0e0e0', fontSize: '14px', fontWeight: 900 }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )

  return null
}

// ─── FIX #6: Parse /file command ─────────────────────────────────
// Format: /file <filename.ext> <deskripsi>
// Contoh: /file app.py buat flask hello world sederhana
function parseFileCmd(text: string): { filename: string; fileType: string; prompt: string } | null {
  const m = text.match(/^\/file\s+(\S+)\s+(.+)$/is)
  if (!m) return null
  const filename = m[1].replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'txt'
  return { filename, fileType: ext, prompt: m[2].trim() }
}

// ─── Main page ────────────────────────────────────────────────────
export default function ChatSessionPage() {
  const params    = useParams()
  const router    = useRouter()
  const sessionId = params.sessionId as string

  const [messages,    setMessages]    = useState<ChatMessage[]>([])
  const [input,       setInput]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [streaming,   setStreaming]   = useState('')
  const [agentIters,  setAgentIters]  = useState<AgentIteration[]>([])
  const [agentMode,   setAgentMode]   = useState(false)
  const [chatMode,    setChatMode]    = useState<'professional' | 'fast'>('professional')
  const [editingId,   setEditingId]   = useState<string | null>(null)
  const [files,       setFiles]       = useState<{ name: string; content: string }[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [panel,       setPanel]       = useState<Panel>('menu')
  const [sessions,    setSessions]    = useState<SessionItem[]>([])
  const [apiKeys,     setApiKeys]     = useState<ApiKeyItem[]>([])
  const [profile,     setProfile]     = useState<ProfileData | null>(null)
  const [newKeyMsg,   setNewKeyMsg]   = useState('')
  const [fileFlash,   setFileFlash]   = useState<{ name: string; url: string } | null>(null)

  const endRef   = useRef<HTMLDivElement>(null)
  const taRef    = useRef<HTMLTextAreaElement>(null)
  const fileRef  = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, streaming, agentIters])
  useEffect(() => {
    const ta = taRef.current; if (!ta) return
    ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'
  }, [input])

  // FIX #1: Load sidebar data — pisah concern, fetch dari endpoint yang benar
  useEffect(() => {
    if (!sidebarOpen) return
    fetch('/api/chat/sessions')
      .then(r => r.json())
      .then(d => { if (d.success) setSessions(d.data) })
      .catch(() => {})
    // FIX: Pakai /api/profile bukan sessions yang ga return user data
    fetch('/api/profile')
      .then(r => r.json())
      .then(d => { if (d.success && d.data) setProfile(d.data) })
      .catch(() => {})
  }, [sidebarOpen])

  useEffect(() => {
    if (!sidebarOpen || (panel !== 'apikeys' && panel !== 'tokens')) return
    fetch('/api/keys/list').then(r => r.json()).then(d => { if (d.success) setApiKeys(d.data ?? []) }).catch(() => {})
  }, [sidebarOpen, panel])

  const openSidebar  = useCallback((p: Panel = 'menu') => { setPanel(p); setSidebarOpen(true) }, [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  const newChat = useCallback(async () => {
    const res  = await fetch('/api/chat/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'New Chat' }) })
    const data = await res.json()
    if (data.success) { closeSidebar(); router.push(`/chat/${data.data.id}`) }
  }, [router, closeSidebar])

  const loadSession = useCallback((id: string) => { closeSidebar(); router.push(`/chat/${id}`) }, [router, closeSidebar])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }); router.push('/login')
  }, [router])

  const generateKey = useCallback(async () => {
    const res  = await fetch('/api/keys/generate', { method: 'POST' })
    const data = await res.json()
    if (data.success) {
      setNewKeyMsg(`Key generated: ${data.key} — simpan sekarang, tidak bisa dilihat lagi!`)
      fetch('/api/keys/list').then(r => r.json()).then(d => { if (d.success) setApiKeys(d.data ?? []) }).catch(() => {})
      setTimeout(() => setNewKeyMsg(''), 30000)
    }
  }, [])

  const revokeKey = useCallback(async (keyId: string) => {
    await fetch('/api/keys/revoke', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyId }) })
    setApiKeys(prev => prev.map(k => k.id === keyId ? { ...k, status: 'revoked' } : k))
  }, [])

  const handleAttach = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(file => {
      if (file.type.startsWith('text/') || TEXT_EXT.test(file.name)) {
        const reader = new FileReader()
        reader.onload = ev => setFiles(prev => [...prev, { name: file.name, content: String(ev.target?.result ?? '').slice(0, 12000) }])
        reader.readAsText(file)
      }
    })
    e.target.value = ''
  }, [])

  // FIX #6: File generation dari /file command
  const handleFileCmd = useCallback(async (cmd: { filename: string; fileType: string; prompt: string }) => {
    const userMsg: ChatMessage = { id: `u_${Date.now()}`, role: 'user', content: `/file ${cmd.filename} — ${cmd.prompt}` }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/files/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ prompt: cmd.prompt, fileType: cmd.fileType, filename: cmd.filename, sessionId }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error ?? 'Gagal generate file')
      const f = data.file
      const reply = `File **\`${f.filename}\`** berhasil dibuat (${f.size_bytes} bytes).\n\n\`\`\`${cmd.fileType}\n${(data.preview ?? '').trim()}\n\`\`\`\n\n[⬇ Download ${f.filename}](${f.storage_url})`
      setMessages(prev => [...prev, { id: `a_${Date.now()}`, role: 'aria', content: reply }])
      setFileFlash({ name: f.filename, url: f.storage_url })
      setTimeout(() => setFileFlash(null), 12000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setMessages(prev => [...prev, { id: `err_${Date.now()}`, role: 'error', content: `File error: ${msg}` }])
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  // ─── Core stream function — reusable by send + regenrate ──────
  const fireStream = useCallback(async (
    userText:     string,
    historyMsgs:  ChatMessage[],
    addUserBubble = true,
  ) => {
    if (loading) return
    setLoading(true); setStreaming(''); setAgentIters([])

    const userMsg: ChatMessage = { id: `u_${Date.now()}`, role: 'user', content: userText }
    if (addUserBubble) setMessages(prev => [...prev, userMsg])

    const controller = new AbortController()
    abortRef.current = controller

    const apiMessages = [
      ...historyMsgs.filter(m => m.role === 'user' || m.role === 'aria').map(m => ({
        role: m.role === 'aria' ? 'assistant' as const : 'user' as const,
        content: m.content,
      })),
      { role: 'user' as const, content: userText },
    ]

    let directContent = ''
    let liveIters:     AgentIteration[] = []
    let doneReceived   = false

    try {
      const res = await fetch('/api/chat/stream', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        signal:  controller.signal,
        body:    JSON.stringify({
          messages:      apiMessages,
          sessionId,
          mode:          agentMode ? 'agent' : 'direct',
          maxIterations: chatMode === 'fast' ? 1 : 5,
        }),
      })
      if (!res.ok) throw new Error(`${res.status} — ${(await res.text()).slice(0, 200)}`)

      const reader = res.body!.getReader()
      const dec    = new TextDecoder()
      let buf          = ''
      let currentIter: AgentIteration | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n'); buf = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try { evt = JSON.parse(line.slice(6)) } catch { continue }

          if (!agentMode) {
            if (evt.type === 'aria_token') { directContent += evt.content ?? ''; setStreaming(directContent) }
            if (evt.type === 'done') {
              doneReceived = true
              setMessages(prev => [...prev, { id: `a_${Date.now()}`, role: 'aria', content: directContent }])
              setStreaming('')
            }
            continue
          }

          if (evt.type === 'iteration_start' && (evt.iteration ?? 0) > 0) {
            currentIter = { iteration: evt.iteration!, ariaContent: '', ariaStreaming: true, nexusContent: '', nexusThinking: '', nexusStreaming: false, verdict: null, notes: '' }
            liveIters = [...liveIters.filter(i => i.iteration !== evt.iteration), currentIter]
            setAgentIters([...liveIters])
          }
          if (evt.type === 'aria_token' && currentIter) {
            currentIter = { ...currentIter, ariaContent: currentIter.ariaContent + (evt.content ?? '') }
            liveIters = updateIter(liveIters, currentIter); setAgentIters([...liveIters])
          }
          if (evt.type === 'nexus_thinking' && currentIter) {
            currentIter = { ...currentIter, nexusContent: currentIter.nexusContent + (evt.content ?? ''), nexusStreaming: true }
            liveIters = updateIter(liveIters, currentIter); setAgentIters([...liveIters])
          }
          if (evt.type === 'nexus_token' && currentIter && evt.content) {
            try {
              const nd = JSON.parse(evt.content)
              currentIter = { ...currentIter, ariaStreaming: false, nexusContent: nd.output ?? currentIter.nexusContent, nexusThinking: nd.thinking ?? currentIter.nexusThinking, nexusStreaming: false, verdict: nd.verdict ?? null, notes: nd.notes ?? '' }
            } catch {
              currentIter = { ...currentIter, nexusContent: currentIter.nexusContent + evt.content, nexusStreaming: true }
            }
            liveIters = updateIter(liveIters, currentIter); setAgentIters([...liveIters])
          }
          if (evt.type === 'done') {
            doneReceived = true
            const last = liveIters[liveIters.length - 1]
            setMessages(prev => [...prev, { id: `ag_${Date.now()}`, role: 'agent', content: last?.ariaContent ?? '', agentIters: [...liveIters], iterations: liveIters.length }])
            setAgentIters([])
          }
          if (evt.type === 'error') throw new Error(evt.content ?? 'Agent error')
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        if (directContent && !agentMode) {
          setMessages(prev => [...prev, { id: `a_${Date.now()}`, role: 'aria', content: directContent + '\n\n*(dihentikan)*' }])
        }
        setStreaming(''); setLoading(false); setAgentIters([])
        return
      }
      setMessages(prev => [...prev, { id: `err_${Date.now()}`, role: 'error', content: err instanceof Error ? err.message : String(err) }])
    } finally {
      if (!doneReceived) {
        if (directContent && !agentMode) {
          setMessages(prev => [...prev, { id: `a_${Date.now()}`, role: 'aria', content: directContent }])
        }
        if (liveIters.length > 0 && agentMode) {
          const last = liveIters[liveIters.length - 1]
          setMessages(prev => [...prev, { id: `ag_${Date.now()}`, role: 'agent', content: last?.ariaContent ?? '', agentIters: [...liveIters], iterations: liveIters.length }])
        }
      }
      setLoading(false); setStreaming(''); setAgentIters([])
    }
  }, [loading, agentMode, chatMode, sessionId])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const fileCmd = parseFileCmd(text)
    if (fileCmd) { handleFileCmd(fileCmd); return }

    let userContent = text
    for (const f of files) userContent += `\n\n<file name="${f.name}">\n${f.content}\n</file>`

    if (editingId) {
      // Edit mode — truncate history to before the edited message, re-fire
      const editIdx = messages.findIndex(m => m.id === editingId)
      const historyBeforeEdit = editIdx > 0 ? messages.slice(0, editIdx) : []
      setMessages(historyBeforeEdit)
      setEditingId(null)
      setInput(''); setFiles([])
      await fireStream(userContent, historyBeforeEdit)
      return
    }

    setInput(''); setFiles([])
    await fireStream(userContent, messages)
  }, [input, files, messages, loading, editingId, fireStream, handleFileCmd])

  // ─── Re-generate last AI response ─────────────────────────────
  const handleRegenerate = useCallback(async () => {
    if (loading) return
    // Find last AI message (from the end)
    let lastAiIdx = -1
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'aria' || messages[i].role === 'agent') { lastAiIdx = i; break }
    }
    if (lastAiIdx === -1) return
    const historyWithoutLast = messages.slice(0, lastAiIdx)
    // Find the user message that preceded it
    const lastUserMsg = [...historyWithoutLast].reverse().find(m => m.role === 'user')
    if (!lastUserMsg) return
    const historyBeforeUser = historyWithoutLast.slice(0, historyWithoutLast.findIndex(m => m.id === lastUserMsg.id))
    setMessages(historyWithoutLast)
    await fireStream(lastUserMsg.content, historyBeforeUser, false)
  }, [messages, loading, fireStream])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#080808', position: 'relative' }}>

      {sidebarOpen && <div onClick={closeSidebar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 40, backdropFilter: 'blur(2px)' }} />}

      <div style={{ position: 'fixed', left: 0, top: 0, bottom: 0, width: '300px', background: '#0f0f0f', borderRight: '1px solid #1e1e1e', zIndex: 50, display: 'flex', flexDirection: 'column', transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 12px', borderBottom: '1px solid #161616' }}>
          <button onClick={closeSidebar} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '4px' }}><IC.Close /></button>
        </div>
        {newKeyMsg && (
          <div style={{ margin: '8px 12px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', padding: '10px 12px', fontSize: '11px', color: '#22c55e', wordBreak: 'break-all' }}>
            {newKeyMsg}
          </div>
        )}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <SidebarContent
            panel={panel} setPanel={setPanel} sessionId={sessionId}
            profile={profile} sessions={sessions} apiKeys={apiKeys}
            onNewChat={newChat} onLoadSession={loadSession} onLogout={logout}
            onGenerateKey={generateKey} onRevokeKey={revokeKey}
          />
        </div>
      </div>

      {/* Header */}
      <div style={{ height: '48px', display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid #161616', background: '#0a0a0a', flexShrink: 0, gap: '12px' }}>
        <button onClick={() => openSidebar('menu')} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', borderRadius: '4px' }}>
          <IC.Menu />
        </button>
        <span style={{ color: '#333', fontSize: '12px', letterSpacing: '0.12em', fontWeight: 700 }}>ARIA C11</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', background: '#111', border: '1px solid #1e1e1e', borderRadius: '4px', overflow: 'hidden' }}>
          <button
            onClick={() => setChatMode('professional')}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', background: chatMode === 'professional' ? 'rgba(255,82,0,0.12)' : 'none', color: chatMode === 'professional' ? '#FF5200' : '#444', border: 'none', borderRight: '1px solid #1e1e1e', cursor: 'pointer' }}
          >
            <IC.Agent /> PRO
          </button>
          <button
            onClick={() => setChatMode('fast')}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', background: chatMode === 'fast' ? 'rgba(129,140,248,0.1)' : 'none', color: chatMode === 'fast' ? '#818cf8' : '#444', border: 'none', cursor: 'pointer' }}
          >
            <IC.Zap /> FAST
          </button>
        </div>
      </div>

      {/* File gen flash notification */}
      {fileFlash && (
        <div style={{ margin: '0 16px', marginTop: '8px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)', padding: '10px 14px', fontSize: '12px', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <IC.File /><span>File <strong>{fileFlash.name}</strong> siap.</span>
          <a href={fileFlash.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
            <IC.ExtLink /> Download
          </a>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {messages.length === 0 && !loading && (
          <div className="welcome">
            <div className="welcome-wordmark">AN<em>ERS</em></div>
            <div className="welcome-rule" />
            <div className="welcome-tag">Aria c11</div>
            <div style={{ color: '#333', fontSize: '11px', marginTop: '12px' }}>Ketik <code style={{ color: '#555' }}>/file app.py &lt;deskripsi&gt;</code> untuk generate file</div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={msg.id} className={`msg ${msg.role === 'user' ? 'user' : msg.role === 'error' ? 'error' : 'assistant'}`}>
            <div className="msg-role" style={{ color: msg.role === 'agent' ? '#818cf8' : msg.role === 'aria' ? '#FF5200' : undefined }}>
              {msg.role === 'agent' ? `aria ↔ nexus · ${msg.iterations ?? 0} iter` : msg.role}
            </div>
            <div className="msg-bubble">
              {msg.role === 'agent'
                ? (msg.agentIters ?? []).map(it => <AgentIterBlock key={it.iteration} iter={it} />)
                : msg.role === 'aria'
                  ? <AriaBubble content={msg.content} />
                  : msg.content
              }
            </div>
            {/* User message — edit button */}
            {msg.role === 'user' && !loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button
                  onClick={() => { setEditingId(msg.id); setInput(msg.content) }}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#333', cursor: 'pointer', fontSize: '10px', padding: '2px 4px' }}
                  title="Edit message"
                >
                  <IC.Edit /> edit
                </button>
              </div>
            )}
            {/* AI message — token count + re-generate on last message */}
            {(msg.role === 'aria' || msg.role === 'agent') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                <span style={{ color: '#2a2a2a', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace' }}>
                  ~{Math.ceil(msg.content.length / 4)} tokens
                </span>
                {idx === messages.length - 1 && !loading && (
                  <button
                    onClick={handleRegenerate}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#333', cursor: 'pointer', fontSize: '10px', padding: '2px 4px' }}
                    title="Re-generate"
                  >
                    <IC.Refresh /> regenerate
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Streaming — FIX #4: parse think real-time saat streaming */}
        {loading && !agentMode && streaming && (
          <div className="msg streaming">
            <div className="msg-role" style={{ color: '#FF5200' }}>aria · streaming</div>
            <div className="msg-bubble"><StreamingBubble content={streaming} /></div>
          </div>
        )}

        {loading && agentMode && agentIters.length > 0 && (
          <div className="msg agent">
            <div className="msg-role" style={{ color: '#818cf8' }}>aria ↔ nexus · running</div>
            <div className="msg-bubble">{agentIters.map(it => <AgentIterBlock key={it.iteration} iter={it} />)}</div>
          </div>
        )}

        {/* FIX: Loading dots HANYA tampil kalau belum ada content (no duplicate) */}
        {loading && !streaming && agentIters.length === 0 && (
          <div className="msg assistant">
            <div className="msg-role">{agentMode ? 'aria ↔ nexus' : 'aria'}</div>
            <div className="msg-bubble"><div className="loading-dots"><span /><span /><span /></div></div>
          </div>
        )}

        <div ref={endRef} style={{ height: '1px' }} />
      </div>

      {/* Input */}
      <div className="input-area">
        {editingId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'rgba(255,82,0,0.06)', borderBottom: '1px solid rgba(255,82,0,0.15)', fontSize: '11px', color: '#FF5200' }}>
            <IC.Edit /> Editing message
            <button onClick={() => { setEditingId(null); setInput('') }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: '0 4px', fontSize: '13px' }}>✕</button>
          </div>
        )}
        {files.length > 0 && (
          <div className="attachments-row">
            {files.map(f => (
              <div key={f.name} className="attach-chip">
                <span className="attach-chip-name">{f.name}</span>
                <button className="attach-chip-del" onClick={() => setFiles(p => p.filter(x => x.name !== f.name))}>×</button>
              </div>
            ))}
          </div>
        )}
        <div className="input-box">
          <textarea
            ref={taRef} className="input-ta" value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder={agentMode ? 'Message Aria (agent mode)...' : 'Message Aria...  ·  /file nama.py <deskripsi>'}
            rows={1} disabled={loading}
          />
          <div className="input-actions">
            <div className="input-left">
              <button className="tool-btn icon-only" onClick={() => fileRef.current?.click()} disabled={loading}><IC.Attach /></button>
              <button className={`tool-btn ${agentMode ? 'on' : ''}`} onClick={() => setAgentMode(v => !v)} style={agentMode ? { color: '#818cf8', borderColor: 'rgba(129,140,248,0.3)' } : {}}><IC.Agent /> Agent</button>
            </div>
            {loading
              ? <button className="send-btn" onClick={() => abortRef.current?.abort()}><IC.Loader /> Stop</button>
              : <button className="send-btn" onClick={send} disabled={!input.trim()}>Send <IC.Send /></button>
            }
          </div>
        </div>
        <input ref={fileRef} type="file" multiple accept="*/*" style={{ display: 'none' }} onChange={handleAttach} />
      </div>
    </div>
  )
}
