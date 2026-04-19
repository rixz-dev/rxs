'use client'
// app/admin/dashboard/page.tsx
// Admin dashboard — stats, user management, security logs, banned IPs

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────
interface User {
  id:               string
  username:         string
  email?:           string
  role:             string
  status:           string
  last_ip?:         string
  registered_ip?:   string
  chat_count_today: number
  created_at:       string
  last_seen_at:     string
}

interface LogEntry {
  id:             string
  ip_address:     string
  user_agent?:    string
  request_path?:  string
  severity:       string
  event_type:     string
  anomaly_score:  number
  action_taken?:  string
  created_at:     string
}

type Tab = 'users' | 'logs' | 'bans'

const SEVERITY_COLOR: Record<string, string> = {
  info:     '#64748b',
  warning:  '#f97316',
  critical: '#ef4444',
}

const ROLE_COLOR: Record<string, string> = {
  free:  '#64748b',
  pro:   '#3b82f6',
  max:   '#FF5200',
  admin: '#a855f7',
}

const STATUS_COLOR: Record<string, string> = {
  active: '#22c55e',
  banned: '#ef4444',
  shadow: '#f97316',
}

// ─── Helpers ──────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)   return 'just now'
  if (m < 60)  return `${m}m ago`
  if (m < 1440) return `${Math.floor(m / 60)}h ago`
  return `${Math.floor(m / 1440)}d ago`
}

// ─── Dashboard ────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter()
  const [tab,       setTab]       = useState<Tab>('users')
  const [users,     setUsers]     = useState<User[]>([])
  const [logs,      setLogs]      = useState<LogEntry[]>([])
  const [bans,      setBans]      = useState<string[]>([])
  const [total,     setTotal]     = useState(0)
  const [page,      setPage]      = useState(1)
  const [search,    setSearch]    = useState('')
  const [loading,   setLoading]   = useState(false)
  const [action,    setAction]    = useState('')  // status feedback

  // ─── Auth check ──────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/admin/tfa', { method: 'GET' })
      .then(r => { if (r.status === 405) return   // GET not implemented — ok
                   if (r.status === 401) router.push('/admin') })
      .catch(() => {})
  }, [router])

  // ─── Fetch data ───────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams({ page: String(page), limit: '25', search })
    const res = await fetch(`/api/admin/users?${qs}`)
    const d   = await res.json()
    if (d.success) { setUsers(d.data); setTotal(d.total) }
    setLoading(false)
  }, [page, search])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/logs?limit=50')
    const d   = await res.json()
    if (d.success) setLogs(d.data)
    setLoading(false)
  }, [])

  const fetchBans = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/ban')
    const d   = await res.json()
    if (d.success) setBans(d.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (tab === 'users') fetchUsers()
    if (tab === 'logs')  fetchLogs()
    if (tab === 'bans')  fetchBans()
  }, [tab, fetchUsers, fetchLogs, fetchBans])

  // ─── Actions ──────────────────────────────────────────────────
  async function updateUser(userId: string, updates: { role?: string; status?: string }) {
    const res = await fetch('/api/admin/users', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userId, ...updates }),
    })
    const d = await res.json()
    setAction(d.success ? `✓ ${d.message}` : `✗ ${d.error}`)
    if (d.success) fetchUsers()
    setTimeout(() => setAction(''), 3000)
  }

  async function banUser(userId: string, action: 'ban' | 'unban') {
    const res = await fetch('/api/admin/ban', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action, target: userId, targetType: 'user' }),
    })
    const d = await res.json()
    setAction(d.success ? `✓ ${d.message}` : `✗ ${d.error}`)
    if (d.success) fetchUsers()
    setTimeout(() => setAction(''), 3000)
  }

  async function unbanIp(ip: string) {
    const res = await fetch('/api/admin/ban', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'unban', target: ip, targetType: 'ip' }),
    })
    const d = await res.json()
    setAction(d.success ? `✓ ${d.message}` : `✗ ${d.error}`)
    if (d.success) fetchBans()
    setTimeout(() => setAction(''), 3000)
  }

  return (
    <div style={S.page}>
      <div style={S.grid} />

      {/* Header */}
      <header style={S.header}>
        <div style={S.headerLeft}>
          <div style={S.logo}>
            <div style={S.logoIcon}><div style={S.logoDot} /></div>
            <span style={S.logoText}>ANERS</span>
          </div>
          <span style={S.headerTag}>Admin Dashboard</span>
        </div>
        <div style={S.headerRight}>
          {action && <span style={{ color: action.startsWith('✓') ? '#22c55e' : '#ef4444', fontSize: '12px' }}>{action}</span>}
          <button style={S.logoutBtn} onClick={() => router.push('/admin')}>Logout</button>
        </div>
      </header>

      {/* Tabs */}
      <div style={S.tabs}>
        {(['users', 'logs', 'bans'] as Tab[]).map(t => (
          <button key={t} style={{ ...S.tab, ...(tab === t ? S.tabActive : {}) }} onClick={() => { setTab(t); setPage(1) }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={S.content}>
        {/* ── USERS TAB ─────────────────────────────────────── */}
        {tab === 'users' && (
          <>
            <div style={S.toolbar}>
              <input
                style={S.searchInput}
                type="text"
                placeholder="Cari username / email..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
              />
              <span style={S.total}>{total} users</span>
            </div>

            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    {['Username', 'Role', 'Status', 'Chat today', 'Last IP', 'Last seen', 'Actions'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: '#444', padding: '32px' }}>Loading...</td></tr>
                  ) : users.map(u => (
                    <tr key={u.id} style={S.tr}>
                      <td style={S.td}>
                        <span style={{ color: '#fff', fontWeight: 600 }}>{u.username}</span>
                        {u.email && <div style={{ color: '#555', fontSize: '11px' }}>{u.email}</div>}
                      </td>
                      <td style={S.td}>
                        <select
                          style={{ ...S.badge, color: ROLE_COLOR[u.role] ?? '#fff', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                          value={u.role}
                          onChange={e => updateUser(u.id, { role: e.target.value })}
                        >
                          {['free', 'pro', 'max'].map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td style={S.td}>
                        <span style={{ color: STATUS_COLOR[u.status] ?? '#fff', fontSize: '11px', fontWeight: 700 }}>
                          {u.status}
                        </span>
                      </td>
                      <td style={{ ...S.td, textAlign: 'center', color: u.chat_count_today > 0 ? '#fff' : '#444' }}>
                        {u.chat_count_today}
                      </td>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '11px', color: '#666' }}>
                        {u.last_ip ?? '—'}
                      </td>
                      <td style={{ ...S.td, color: '#555', fontSize: '11px' }}>
                        {u.last_seen_at ? timeAgo(u.last_seen_at) : '—'}
                      </td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {u.status !== 'banned' ? (
                            <button style={S.btnDanger} onClick={() => banUser(u.id, 'ban')}>BAN</button>
                          ) : (
                            <button style={S.btnSuccess} onClick={() => banUser(u.id, 'unban')}>UNBAN</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={S.pagination}>
              <button style={S.pageBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span style={{ color: '#555', fontSize: '12px' }}>Page {page} · {Math.ceil(total / 25)} total</span>
              <button style={S.pageBtn} disabled={page * 25 >= total} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          </>
        )}

        {/* ── LOGS TAB ──────────────────────────────────────── */}
        {tab === 'logs' && (
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  {['Time', 'Severity', 'Event', 'IP', 'Score', 'Path', 'Action'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ ...S.td, textAlign: 'center', color: '#444', padding: '32px' }}>Loading...</td></tr>
                ) : logs.map(log => (
                  <tr key={log.id} style={S.tr}>
                    <td style={{ ...S.td, color: '#555', fontSize: '11px', whiteSpace: 'nowrap' }}>
                      {timeAgo(log.created_at)}
                    </td>
                    <td style={S.td}>
                      <span style={{ color: SEVERITY_COLOR[log.severity] ?? '#fff', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                        {log.severity}
                      </span>
                    </td>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '11px', color: '#ccc' }}>
                      {log.event_type}
                    </td>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '11px', color: '#666' }}>
                      {log.ip_address}
                    </td>
                    <td style={{ ...S.td, textAlign: 'center' }}>
                      <span style={{
                        color:      log.anomaly_score >= 70 ? '#ef4444' : log.anomaly_score >= 40 ? '#f97316' : '#555',
                        fontSize:   '12px',
                        fontWeight: 700,
                      }}>
                        {log.anomaly_score}
                      </span>
                    </td>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '11px', color: '#555', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.request_path ?? '—'}
                    </td>
                    <td style={{ ...S.td, fontSize: '11px', color: '#666' }}>
                      {log.action_taken ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── BANS TAB ──────────────────────────────────────── */}
        {tab === 'bans' && (
          <>
            <div style={S.toolbar}>
              <span style={S.total}>{bans.length} banned IP{bans.length !== 1 ? 's' : ''}</span>
              <button style={{ ...S.pageBtn, marginLeft: 'auto' }} onClick={fetchBans}>Refresh</button>
            </div>

            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>IP Address</th>
                    <th style={S.th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={2} style={{ ...S.td, textAlign: 'center', color: '#444', padding: '32px' }}>Loading...</td></tr>
                  ) : bans.length === 0 ? (
                    <tr><td colSpan={2} style={{ ...S.td, textAlign: 'center', color: '#444', padding: '32px' }}>No banned IPs.</td></tr>
                  ) : bans.map(ip => (
                    <tr key={ip} style={S.tr}>
                      <td style={{ ...S.td, fontFamily: 'monospace', color: '#ef4444' }}>{ip}</td>
                      <td style={S.td}>
                        <button style={S.btnSuccess} onClick={() => unbanIp(ip)}>UNBAN</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  page:     { minHeight: '100vh', background: '#080808', color: '#ccc', fontFamily: 'inherit', position: 'relative' },
  grid:     { position: 'fixed', inset: 0, opacity: 0.02, backgroundImage: 'linear-gradient(#FF5200 1px, transparent 1px), linear-gradient(90deg, #FF5200 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' },
  header:   { position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', background: '#080808', borderBottom: '1px solid #1a1a1a' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '16px' },
  logo:     { display: 'flex', alignItems: 'center', gap: '8px' },
  logoIcon: { width: '22px', height: '22px', border: '1px solid #FF5200', transform: 'rotate(45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoDot:  { width: '8px', height: '8px', background: '#FF5200' },
  logoText: { color: '#fff', fontWeight: 900, letterSpacing: '0.15em', fontSize: '14px' },
  headerTag: { color: '#444', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' },
  logoutBtn: { background: 'none', border: '1px solid #2a2a2a', color: '#666', padding: '5px 12px', fontSize: '11px', cursor: 'pointer', letterSpacing: '0.08em', fontFamily: 'inherit' },
  tabs:     { display: 'flex', gap: '0', borderBottom: '1px solid #1a1a1a', padding: '0 24px' },
  tab:      { background: 'none', border: 'none', borderBottom: '2px solid transparent', color: '#555', padding: '12px 16px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '-1px' },
  tabActive: { color: '#FF5200', borderBottomColor: '#FF5200' },
  content:  { padding: '20px 24px', position: 'relative' },
  toolbar:  { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' },
  searchInput: { background: '#0f0f0f', border: '1px solid #222', color: '#ccc', padding: '8px 12px', fontSize: '13px', outline: 'none', width: '260px', fontFamily: 'inherit' },
  total:    { color: '#555', fontSize: '12px' },
  tableWrap: { overflowX: 'auto' as const },
  table:    { width: '100%', borderCollapse: 'collapse' as const, fontSize: '13px' },
  th:       { textAlign: 'left' as const, color: '#444', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, padding: '8px 12px', borderBottom: '1px solid #1a1a1a', whiteSpace: 'nowrap' as const },
  td:       { padding: '10px 12px', borderBottom: '1px solid #111', verticalAlign: 'middle' as const },
  tr:       { transition: 'background .1s' },
  badge:    { fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const },
  btnDanger:  { background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', color: '#ef4444', padding: '4px 10px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', cursor: 'pointer', fontFamily: 'inherit' },
  btnSuccess: { background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.3)', color: '#22c55e', padding: '4px 10px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', cursor: 'pointer', fontFamily: 'inherit' },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginTop: '16px' },
  pageBtn:  { background: 'none', border: '1px solid #2a2a2a', color: '#666', padding: '6px 14px', fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit' },
}
