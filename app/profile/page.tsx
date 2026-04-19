'use client'
// app/profile/page.tsx
// Profile & Settings page — full page, bukan sidebar panel
// FIX: Sebelumnya profile ada di sidebar inline panel dengan fetch yang salah.
// Sekarang jadi page tersendiri: /profile → load instant, tidak perlu buka sidebar dulu.

import { useState, useEffect } from 'react'
import { useRouter }           from 'next/navigation'

const ROLE_COLOR: Record<string, string> = { free: '#64748b', pro: '#3b82f6', max: '#FF5200', admin: '#a855f7' }
const ROLE_LIMIT: Record<string, string> = { free: '10 chat/2jam', pro: '20 chat/2jam', max: '40 chat/3jam', admin: 'Unlimited' }

interface ProfileData {
  username:        string
  email:           string | null
  role:            string
  chat_count_today: number
  last_seen_at:    string
  created_at:      string
}

interface ApiKey {
  id: string; key_prefix: string; status: string
  created_at: string; total_requests: number; total_tokens: number
}

function Badge({ role }: { role: string }) {
  const color = ROLE_COLOR[role] ?? '#555'
  return (
    <span style={{ display: 'inline-block', background: `${color}22`, color, border: `1px solid ${color}44`, fontSize: '10px', padding: '3px 10px', letterSpacing: '0.12em', fontWeight: 700 }}>
      {role.toUpperCase()}
    </span>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile]   = useState<ProfileData | null>(null)
  const [apiKeys, setApiKeys]   = useState<ApiKey[]>([])
  const [loading, setLoading]   = useState(true)
  const [newKeyMsg, setNewKeyMsg] = useState('')
  const [copiedId, setCopiedId]  = useState('')
  const [err, setErr]            = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/profile').then(r => r.json()),
      fetch('/api/keys/list').then(r => r.json()),
    ]).then(([pd, kd]) => {
      if (pd.success) setProfile(pd.data)
      else setErr(pd.error ?? 'Gagal load profil')
      if (kd.success) setApiKeys(kd.data ?? [])
    }).catch(() => setErr('Gagal memuat data profil')).finally(() => setLoading(false))
  }, [])

  const generateKey = async () => {
    const res  = await fetch('/api/keys/generate', { method: 'POST' })
    const data = await res.json()
    if (data.success) {
      setNewKeyMsg(`${data.key}`)
      const kd = await fetch('/api/keys/list').then(r => r.json())
      if (kd.success) setApiKeys(kd.data ?? [])
      setTimeout(() => setNewKeyMsg(''), 30000)
    }
  }

  const revokeKey = async (id: string) => {
    await fetch('/api/keys/revoke', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ keyId: id }) })
    setApiKeys(prev => prev.map(k => k.id === id ? { ...k, status: 'revoked' } : k))
  }

  const copyKey = (text: string, id: string) => {
    navigator.clipboard?.writeText(text).catch(() => {})
    setCopiedId(id); setTimeout(() => setCopiedId(''), 1500)
  }

  const S = {
    page:    { minHeight: '100dvh', background: '#080808', color: '#e0e0e0', fontFamily: 'JetBrains Mono, monospace', padding: '0' } as React.CSSProperties,
    header:  { height: '48px', display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid #161616', background: '#0a0a0a', gap: '14px', flexShrink: 0, position: 'sticky' as const, top: 0, zIndex: 10 } as React.CSSProperties,
    body:    { maxWidth: '640px', margin: '0 auto', padding: '32px 20px' } as React.CSSProperties,
    card:    { background: '#0f0f0f', border: '1px solid #1e1e1e', padding: '20px 24px', marginBottom: '16px' } as React.CSSProperties,
    label:   { color: '#444', fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginBottom: '4px' } as React.CSSProperties,
    val:     { color: '#e0e0e0', fontSize: '13px', marginBottom: '16px' } as React.CSSProperties,
    keycard: { background: '#111', border: '1px solid #1e1e1e', padding: '12px 14px', marginBottom: '8px' } as React.CSSProperties,
    btn:     { display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,82,0,0.08)', border: '1px solid rgba(255,82,0,0.25)', color: '#FF5200', padding: '9px 16px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em' } as React.CSSProperties,
    dangerBtn: { display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', padding: '7px 12px', cursor: 'pointer', fontSize: '11px' } as React.CSSProperties,
    smallBtn:  { display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: '1px solid #2a2a2a', color: '#666', padding: '6px 10px', cursor: 'pointer', fontSize: '11px' } as React.CSSProperties,
    sec:     { color: '#444', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: '12px', marginTop: '0' } as React.CSSProperties,
  }

  if (loading) return (
    <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#333', fontSize: '12px', letterSpacing: '0.1em' }}>LOADING PROFILE...</div>
    </div>
  )

  if (err) return (
    <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#ef4444', fontSize: '12px' }}>{err}</div>
    </div>
  )

  return (
    <div style={S.page}>
      {/* Sticky header */}
      <div style={S.header}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M5 12l7-7M5 12l7 7"/></svg>
        </button>
        <span style={{ color: '#333', fontSize: '12px', letterSpacing: '0.12em', fontWeight: 700 }}>PROFILE &amp; SETTINGS</span>
      </div>

      <div style={S.body}>

        {/* Avatar + username */}
        {profile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <div style={{ width: '56px', height: '56px', background: 'rgba(255,82,0,0.08)', border: '1px solid rgba(255,82,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF5200', fontWeight: 900, fontSize: '22px', flexShrink: 0 }}>
              {profile.username[0].toUpperCase()}
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '18px', marginBottom: '4px' }}>{profile.username}</div>
              <Badge role={profile.role} />
            </div>
          </div>
        )}

        {/* Account info */}
        {profile && (
          <div style={S.card}>
            <p style={S.sec}>Account Info</p>
            <div style={S.label}>Username</div>
            <div style={S.val}>{profile.username}</div>
            <div style={S.label}>Email</div>
            <div style={S.val}>{profile.email ?? '—'}</div>
            <div style={S.label}>Role</div>
            <div style={{ marginBottom: '16px' }}><Badge role={profile.role} /></div>
            <div style={S.label}>Chat Limit</div>
            <div style={S.val}>{ROLE_LIMIT[profile.role] ?? '—'}</div>
            <div style={S.label}>Chat Hari Ini</div>
            <div style={{ ...S.val, color: '#FF5200', fontSize: '20px', fontWeight: 900 }}>{profile.chat_count_today}</div>
            <div style={S.label}>Member Sejak</div>
            <div style={S.val}>{new Date(profile.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
        )}

        {/* API Keys */}
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <p style={{ ...S.sec, marginBottom: 0 }}>API Keys</p>
            <button onClick={generateKey} style={S.btn}>+ Generate Key</button>
          </div>

          {/* Flash new key */}
          {newKeyMsg && (
            <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.25)', padding: '12px 14px', marginBottom: '14px', fontSize: '11px', color: '#22c55e' }}>
              <div style={{ color: '#444', fontSize: '10px', letterSpacing: '0.1em', marginBottom: '4px' }}>KEY BARU — SIMPAN SEKARANG, TIDAK BISA DILIHAT LAGI</div>
              <code style={{ wordBreak: 'break-all', fontSize: '12px' }}>{newKeyMsg}</code>
              <button onClick={() => copyKey(newKeyMsg, 'new')} style={{ ...S.smallBtn, marginTop: '8px', color: '#22c55e', borderColor: 'rgba(34,197,94,0.3)' }}>
                {copiedId === 'new' ? 'COPIED!' : 'COPY KEY'}
              </button>
            </div>
          )}

          {apiKeys.length === 0 && !newKeyMsg && (
            <p style={{ color: '#333', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>Belum ada API key</p>
          )}

          {apiKeys.map(k => (
            <div key={k.id} style={S.keycard}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <code style={{ color: '#FF5200', fontSize: '13px' }}>{k.key_prefix}...</code>
                <span style={{ color: k.status === 'active' ? '#22c55e' : '#555', fontSize: '10px', fontWeight: 700 }}>{k.status.toUpperCase()}</span>
              </div>
              <div style={{ color: '#444', fontSize: '10px', marginBottom: '10px' }}>
                Requests: {k.total_requests.toLocaleString()} · Tokens: {k.total_tokens.toLocaleString()} · Dibuat: {new Date(k.created_at).toLocaleDateString('id-ID')}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => copyKey(k.key_prefix, k.id)} style={S.smallBtn}>
                  {copiedId === k.id ? 'COPIED' : 'COPY PREFIX'}
                </button>
                {k.status === 'active' && (
                  <button onClick={() => revokeKey(k.id)} style={S.dangerBtn}>REVOKE</button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Quick nav */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
          <button onClick={() => router.push('/chat')} style={{ ...S.smallBtn, flex: 1, justifyContent: 'center', padding: '12px' }}>← Back to Chat</button>
          <a href="/docs" target="_blank" rel="noopener noreferrer" style={{ ...S.smallBtn, flex: 1, justifyContent: 'center', padding: '12px', textDecoration: 'none', color: '#666' }}>API Docs ↗</a>
        </div>
      </div>
    </div>
  )
}
