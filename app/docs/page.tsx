'use client'
// app/docs/page.tsx — ANERS Public API Documentation

import { useState } from 'react'
import Link from 'next/link'

interface Endpoint {
  method: string
  path:   string
  auth:   boolean
  desc:   string
  body?:  string
  response?: string
}

const ENDPOINTS: Endpoint[] = [
  {
    method: 'POST', path: '/api/chat/stream', auth: true,
    desc:   'Stream AI response (Aria direct atau Agent mode)',
    body:   '{\n  "messages": [{"role":"user","content":"..."}],\n  "mode": "direct" | "agent",\n  "sessionId": "uuid" // optional\n}',
    response: 'SSE stream — event: aria_token | done | error',
  },
  {
    method: 'POST', path: '/api/files/generate', auth: true,
    desc:   'AI-generate sebuah file berdasarkan prompt',
    body:   '{\n  "prompt": "Buat Python script ...",\n  "fileType": "py",\n  "filename": "script.py"\n}',
    response: '{\n  "success": true,\n  "file": { "id","filename","storage_url","size_bytes" },\n  "preview": "first 500 chars"\n}',
  },
  {
    method: 'POST', path: '/api/files/upload', auth: true,
    desc:   'Upload file dari client (multipart/form-data)',
    body:   'FormData: file (File), sessionId (string, optional)',
    response: '{ "success": true, "file": { "id","filename","storage_url" } }',
  },
  {
    method: 'GET', path: '/api/files/[fileId]', auth: true,
    desc:   'Download file — redirect ke Vercel Blob URL',
    response: '302 redirect ke blob URL',
  },
  {
    method: 'DELETE', path: '/api/files/[fileId]', auth: true,
    desc:   'Hapus file (hanya owner)',
    response: '{ "success": true }',
  },
  {
    method: 'GET',    path: '/api/chat/sessions', auth: true, desc: 'List semua chat session milik user',
    response: '{ "success":true, "data":[...], "total":n }',
  },
  {
    method: 'POST',   path: '/api/chat/sessions', auth: true, desc: 'Buat session baru',
    body: '{ "title": "Session name" }',
    response: '{ "success":true, "data": { "id","title","status" } }',
  },
  {
    method: 'POST', path: '/api/auth/register', auth: false,
    desc: 'Daftar akun baru',
    body: '{ "username":"...", "email":"...", "password":"..." }',
    response: '{ "success": true, "message": "Akun berhasil dibuat." }',
  },
  {
    method: 'POST', path: '/api/auth/login', auth: false,
    desc: 'Login',
    body: '{ "email":"...", "password":"..." }',
    response: '{ "success":true, "user":{"id","username","role"} }',
  },
  {
    method: 'POST', path: '/api/upgrade/redeem', auth: true,
    desc: 'Redeem upgrade code (dari Telegram @fourhoundredfour_404)',
    body: '{ "code": "ANERS-XXXXXXXXXXXX" }',
    response: '{ "success":true, "newRole":"pro"|"max" }',
  },
  {
    method: 'POST', path: '/api/keys/generate', auth: true,
    desc: 'Generate API key untuk akses external (max 3)',
    response: '{ "success":true, "key":"anrs_...", "data":{...} }',
  },
  {
    method: 'POST', path: '/api/keys/revoke', auth: true,
    desc: 'Revoke API key',
    body: '{ "keyId": "uuid" }',
    response: '{ "success": true }',
  },
]

const METHOD_COLOR: Record<string, string> = {
  GET:    '#22c55e',
  POST:   '#3b82f6',
  DELETE: '#ef4444',
  PATCH:  '#f97316',
}

export default function DocsPage() {
  const [active, setActive] = useState<number | null>(null)

  return (
    <div style={S.page}>
      <div style={S.grid} />

      {/* Header */}
      <header style={S.header}>
        <Link href="/chat" style={S.backLink}>← Back to Chat</Link>
        <div style={S.headerCenter}>
          <span style={S.logo}>ANERS</span>
          <span style={S.headerTag}>API Reference</span>
        </div>
        <div style={{ width: '80px' }} />
      </header>

      <div style={S.content}>
        {/* Intro */}
        <div style={S.intro}>
          <h1 style={S.h1}>ANERS API</h1>
          <p style={S.p}>
            REST + SSE API untuk integrasi Aria AI ke dalam aplikasi kamu.
            Semua request membutuhkan autentikasi via session cookie kecuali endpoint yang ditandai <span style={{ color: '#22c55e' }}>public</span>.
          </p>

          <div style={S.infoGrid}>
            <div style={S.infoCard}>
              <div style={S.infoLabel}>BASE URL</div>
              <code style={S.code}>https://aners.vercel.app</code>
            </div>
            <div style={S.infoCard}>
              <div style={S.infoLabel}>Auth Method</div>
              <code style={S.code}>Session Cookie (auto dari login)</code>
            </div>
            <div style={S.infoCard}>
              <div style={S.infoLabel}>Content-Type</div>
              <code style={S.code}>application/json</code>
            </div>
            <div style={S.infoCard}>
              <div style={S.infoLabel}>Streaming</div>
              <code style={S.code}>text/event-stream (SSE)</code>
            </div>
          </div>
        </div>

        {/* Rate limits */}
        <div style={S.section}>
          <h2 style={S.h2}>Rate Limits</h2>
          <table style={S.table}>
            <thead>
              <tr>
                {['Plan', 'Chat / 2 jam', 'Tool sessions / hari', 'Harga'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Free',  '10',    '7',         'Gratis'],
                ['Pro',   '20',    '15',         'Rp 15.000 / bulan'],
                ['Max',   '40',    'Unlimited',  'Rp 25.000 / 2 bulan'],
                ['Admin', '∞',     '∞',          '—'],
              ].map(([plan, chat, tool, price]) => (
                <tr key={plan} style={S.tr}>
                  <td style={S.td}><span style={{ color: plan === 'Max' ? '#FF5200' : plan === 'Pro' ? '#3b82f6' : '#888', fontWeight: 700 }}>{plan}</span></td>
                  <td style={S.td}>{chat}</td>
                  <td style={S.td}>{tool}</td>
                  <td style={{ ...S.td, color: '#888' }}>{price}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ ...S.p, marginTop: '12px' }}>
            Upgrade via Telegram <a href="https://t.me/fourhoundredfour_404" style={S.link} target="_blank" rel="noopener noreferrer">@fourhoundredfour_404</a>.
            Setelah bayar, kamu dapet code → redeem via <code style={S.inlineCode}>/api/upgrade/redeem</code>.
          </p>
        </div>

        {/* Endpoints */}
        <div style={S.section}>
          <h2 style={S.h2}>Endpoints</h2>
          <div style={S.endpointList}>
            {ENDPOINTS.map((ep, i) => (
              <div key={i} style={S.endpointCard}>
                <button
                  style={S.endpointHeader}
                  onClick={() => setActive(active === i ? null : i)}
                >
                  <div style={S.endpointLeft}>
                    <span style={{ ...S.methodBadge, color: METHOD_COLOR[ep.method] ?? '#fff', borderColor: METHOD_COLOR[ep.method] ?? '#333' }}>
                      {ep.method}
                    </span>
                    <code style={S.pathCode}>{ep.path}</code>
                    {!ep.auth && <span style={S.publicBadge}>public</span>}
                  </div>
                  <div style={S.endpointRight}>
                    <span style={S.epDesc}>{ep.desc}</span>
                    <span style={{ color: '#444', fontSize: '12px' }}>{active === i ? '▲' : '▼'}</span>
                  </div>
                </button>

                {active === i && (
                  <div style={S.endpointBody}>
                    {ep.body && (
                      <div style={S.codeBlock}>
                        <div style={S.codeLabel}>Request Body</div>
                        <pre style={S.pre}>{ep.body}</pre>
                      </div>
                    )}
                    {ep.response && (
                      <div style={S.codeBlock}>
                        <div style={S.codeLabel}>Response</div>
                        <pre style={S.pre}>{ep.response}</pre>
                      </div>
                    )}

                    {/* Curl example */}
                    <div style={S.codeBlock}>
                      <div style={S.codeLabel}>cURL Example</div>
                      <pre style={S.pre}>
{`curl -X ${ep.method} https://aners.vercel.app${ep.path} \\
  -H "Content-Type: application/json" \\
  ${ep.body ? `-d '${ep.body.split('\n')[0]}'` : ''}`}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* SSE Guide */}
        <div style={S.section}>
          <h2 style={S.h2}>Handling SSE Stream</h2>
          <div style={S.codeBlock}>
            <div style={S.codeLabel}>JavaScript Example</div>
            <pre style={S.pre}>{`const res = await fetch('/api/chat/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Hello Aria!' }],
    mode: 'direct'
  })
})

const reader = res.body.getReader()
const dec = new TextDecoder()
let buf = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  buf += dec.decode(value, { stream: true })
  const lines = buf.split('\\n')
  buf = lines.pop() || ''

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue
    const evt = JSON.parse(line.slice(6))
    if (evt.type === 'aria_token') process.stdout.write(evt.content)
    if (evt.type === 'done') console.log('\\nDone!')
    if (evt.type === 'error') console.error(evt.error)
  }
}`}</pre>
          </div>
        </div>

        {/* Error codes */}
        <div style={S.section}>
          <h2 style={S.h2}>Error Codes</h2>
          <table style={S.table}>
            <thead><tr>{['Code','Meaning'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {[
                ['400','Bad Request — field wajib kosong atau format salah'],
                ['401','Unauthorized — belum login atau session expired'],
                ['403','Forbidden — akun banned atau bukan owner resource'],
                ['404','Not Found'],
                ['409','Conflict — username/email sudah dipakai'],
                ['413','Payload Too Large — file melebihi 5MB'],
                ['429','Too Many Requests — rate limit atau tool session limit tercapai'],
                ['500','Internal Server Error'],
              ].map(([code, meaning]) => (
                <tr key={code} style={S.tr}>
                  <td style={{ ...S.td, fontFamily: 'monospace', color: parseInt(code) >= 500 ? '#ef4444' : parseInt(code) >= 400 ? '#f97316' : '#fff' }}>{code}</td>
                  <td style={{ ...S.td, color: '#888' }}>{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <footer style={S.footer}>
        ANERS API © 2025 · <a href="https://t.me/fourhoundredfour_404" style={S.link} target="_blank" rel="noopener noreferrer">@fourhoundredfour_404</a>
      </footer>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page:         { minHeight: '100vh', background: '#080808', color: '#ccc', fontFamily: 'inherit', position: 'relative' },
  grid:         { position: 'fixed', inset: 0, opacity: 0.02, backgroundImage: 'linear-gradient(#FF5200 1px, transparent 1px), linear-gradient(90deg, #FF5200 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' },
  header:       { position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', background: '#080808', borderBottom: '1px solid #1a1a1a' },
  backLink:     { color: '#555', fontSize: '12px', textDecoration: 'none', width: '80px' },
  headerCenter: { display: 'flex', alignItems: 'center', gap: '10px' },
  logo:         { color: '#fff', fontWeight: 900, letterSpacing: '0.2em', fontSize: '14px' },
  headerTag:    { color: '#444', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' },
  content:      { maxWidth: '860px', margin: '0 auto', padding: '32px 24px' },
  intro:        { marginBottom: '40px' },
  h1:           { color: '#fff', fontSize: '26px', fontWeight: 900, letterSpacing: '0.05em', marginBottom: '12px', margin: '0 0 12px' },
  h2:           { color: '#fff', fontSize: '16px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '16px', margin: '0 0 16px', borderBottom: '1px solid #1a1a1a', paddingBottom: '8px' },
  p:            { color: '#888', fontSize: '14px', lineHeight: 1.7, margin: '0 0 16px' },
  section:      { marginBottom: '40px' },
  infoGrid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginTop: '20px' },
  infoCard:     { background: '#0f0f0f', border: '1px solid #1a1a1a', padding: '12px 14px' },
  infoLabel:    { color: '#555', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' },
  code:         { color: '#FF5200', fontSize: '12px', fontFamily: 'monospace' },
  inlineCode:   { background: '#1a1a1a', color: '#FF5200', padding: '1px 5px', fontFamily: 'monospace', fontSize: '12px' },
  table:        { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th:           { textAlign: 'left', color: '#444', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '8px 12px', borderBottom: '1px solid #1a1a1a' },
  td:           { padding: '10px 12px', borderBottom: '1px solid #111' },
  tr:           {},
  link:         { color: '#FF5200', textDecoration: 'none' },
  endpointList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  endpointCard: { border: '1px solid #1a1a1a', background: '#0a0a0a', overflow: 'hidden' },
  endpointHeader: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', gap: '16px', fontFamily: 'inherit', textAlign: 'left', flexWrap: 'wrap' },
  endpointLeft: { display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 },
  endpointRight: { display: 'flex', alignItems: 'center', gap: '12px', flex: 1, justifyContent: 'flex-end' },
  methodBadge:  { fontSize: '10px', fontWeight: 900, letterSpacing: '0.1em', border: '1px solid', padding: '2px 7px' },
  pathCode:     { color: '#ddd', fontFamily: 'monospace', fontSize: '13px' },
  publicBadge:  { background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.3)', color: '#22c55e', fontSize: '10px', padding: '2px 7px', fontWeight: 700, letterSpacing: '0.08em' },
  epDesc:       { color: '#666', fontSize: '12px' },
  endpointBody: { borderTop: '1px solid #1a1a1a', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: '12px' },
  codeBlock:    { background: '#060606', border: '1px solid #1a1a1a' },
  codeLabel:    { color: '#444', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '6px 10px', borderBottom: '1px solid #111' },
  pre:          { margin: 0, padding: '12px 14px', fontFamily: 'monospace', fontSize: '12px', color: '#999', overflowX: 'auto', whiteSpace: 'pre' },
  footer:       { textAlign: 'center', padding: '24px', color: '#333', fontSize: '12px', borderTop: '1px solid #1a1a1a', marginTop: '40px' },
}
