'use client'
// app/admin/page.tsx
// Admin login — SHA256 password + Telegram OTP (2 steps)

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Step = 'password' | 'otp' | 'done'

export default function AdminLoginPage() {
  const router = useRouter()
  const [step,     setStep]     = useState<Step>('password')
  const [password, setPassword] = useState('')
  const [otp,      setOtp]      = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  // ── Step 1: password ──────────────────────────────────────────
  async function handlePassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res  = await fetch('/api/admin/verify', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password }),
    })
    const data = await res.json()
    setLoading(false)

    if (!data.success) { setError(data.error); return }
    setStep('otp')
  }

  // ── Step 2: OTP ───────────────────────────────────────────────
  async function handleOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res  = await fetch('/api/admin/tfa', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ otp }),
    })
    const data = await res.json()
    setLoading(false)

    if (!data.success) { setError(data.error); return }
    setStep('done')
    router.push('/admin/dashboard')
  }

  return (
    <div style={S.page}>
      <div style={S.grid} />

      <div style={S.card}>
        {/* Logo */}
        <div style={S.logoWrap}>
          <div style={S.logoIcon}>
            <div style={S.logoInner} />
          </div>
          <span style={S.logoText}>ANERS</span>
        </div>
        <p style={S.logoSub}>Admin Panel</p>

        {/* Step indicator */}
        <div style={S.steps}>
          <div style={{ ...S.step, ...(step !== 'password' ? S.stepDone : S.stepActive) }}>
            {step !== 'password' ? '✓' : '1'} Password
          </div>
          <div style={S.stepLine} />
          <div style={{
            ...S.step,
            ...(step === 'otp' ? S.stepActive : step === 'done' ? S.stepDone : S.stepInactive),
          }}>
            {step === 'done' ? '✓' : '2'} OTP
          </div>
        </div>

        {/* Password form */}
        {step === 'password' && (
          <form onSubmit={handlePassword} style={S.form}>
            <div style={S.field}>
              <label style={S.label}>ADMIN PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={S.input}
                placeholder="••••••••••••"
                required
                autoFocus
                autoComplete="current-password"
              />
            </div>

            {error && <div style={S.errorBox}>{error}</div>}

            <button type="submit" disabled={loading} style={S.btn}>
              {loading ? 'VERIFYING...' : 'VERIFY PASSWORD'}
            </button>
          </form>
        )}

        {/* OTP form */}
        {step === 'otp' && (
          <form onSubmit={handleOtp} style={S.form}>
            <div style={S.infoBox}>
              Kode verifikasi telah dikirim ke Telegram admin.
            </div>

            <div style={S.field}>
              <label style={S.label}>KODE VERIFIKASI</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                style={{ ...S.input, textAlign: 'center', letterSpacing: '0.4em', fontSize: '20px' }}
                placeholder="000000"
                required
                autoFocus
              />
              <p style={S.hint}>6 digit · expired dalam 5 menit</p>
            </div>

            {error && <div style={S.errorBox}>{error}</div>}

            <button type="submit" disabled={loading || otp.length !== 6} style={S.btn}>
              {loading ? 'VERIFYING...' : 'MASUK'}
            </button>

            <button
              type="button"
              style={S.backBtn}
              onClick={() => { setStep('password'); setOtp(''); setError('') }}
            >
              ← Kembali
            </button>
          </form>
        )}
      </div>

      <p style={S.footer}>ANERS Admin · Akses Terbatas</p>
    </div>
  )
}

// ─── Inline styles — no Tailwind class conflicts ──────────────────
const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight:       '100vh',
    background:      '#080808',
    display:         'flex',
    flexDirection:   'column',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         '16px',
    fontFamily:      'inherit',
    position:        'relative',
  },
  grid: {
    position:    'fixed',
    inset:       0,
    opacity:     0.025,
    backgroundImage: 'linear-gradient(#FF5200 1px, transparent 1px), linear-gradient(90deg, #FF5200 1px, transparent 1px)',
    backgroundSize: '40px 40px',
    pointerEvents: 'none',
  },
  card: {
    position:  'relative',
    width:     '100%',
    maxWidth:  '380px',
    background: '#0f0f0f',
    border:    '1px solid #222',
    padding:   '36px 32px',
  },
  logoWrap: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            '10px',
    marginBottom:   '4px',
  },
  logoIcon: {
    width:          '28px',
    height:         '28px',
    border:         '1px solid #FF5200',
    transform:      'rotate(45deg)',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
  },
  logoInner: {
    width:      '10px',
    height:     '10px',
    background: '#FF5200',
  },
  logoText: {
    color:       '#fff',
    fontSize:    '20px',
    fontWeight:  900,
    letterSpacing: '0.15em',
  },
  logoSub: {
    textAlign:     'center',
    color:         '#444',
    fontSize:      '11px',
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    marginBottom:  '28px',
    margin:        '0 0 28px',
  },
  steps: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            '8px',
    marginBottom:   '24px',
  },
  step: {
    fontSize:      '11px',
    fontWeight:    700,
    letterSpacing: '0.05em',
    padding:       '4px 12px',
    border:        '1px solid',
  },
  stepActive: {
    color:       '#FF5200',
    borderColor: '#FF5200',
    background:  'rgba(255,82,0,0.08)',
  },
  stepDone: {
    color:       '#22c55e',
    borderColor: '#22c55e',
    background:  'rgba(34,197,94,0.08)',
  },
  stepInactive: {
    color:       '#444',
    borderColor: '#2a2a2a',
  },
  stepLine: {
    width:      '24px',
    height:     '1px',
    background: '#2a2a2a',
  },
  form: {
    display:       'flex',
    flexDirection: 'column',
    gap:           '16px',
  },
  field: {
    display:       'flex',
    flexDirection: 'column',
    gap:           '8px',
  },
  label: {
    color:         '#666',
    fontSize:      '10px',
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    fontWeight:    700,
  },
  input: {
    background:   '#080808',
    border:       '1px solid #2a2a2a',
    color:        '#fff',
    padding:      '12px 14px',
    fontSize:     '14px',
    outline:      'none',
    width:        '100%',
    boxSizing:    'border-box' as const,
    fontFamily:   'inherit',
  },
  hint: {
    color:    '#444',
    fontSize: '11px',
    margin:   0,
  },
  errorBox: {
    background:  'rgba(239,68,68,0.07)',
    border:      '1px solid rgba(239,68,68,0.3)',
    color:       '#ef4444',
    padding:     '10px 12px',
    fontSize:    '13px',
    lineHeight:  1.4,
  },
  infoBox: {
    background:  'rgba(255,82,0,0.06)',
    border:      '1px solid rgba(255,82,0,0.2)',
    color:       '#999',
    padding:     '10px 12px',
    fontSize:    '13px',
    lineHeight:  1.5,
  },
  btn: {
    background:    '#FF5200',
    color:         '#000',
    border:        'none',
    padding:       '13px',
    fontSize:      '12px',
    fontWeight:    900,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    cursor:        'pointer',
    width:         '100%',
    fontFamily:    'inherit',
  },
  backBtn: {
    background:  'none',
    border:      'none',
    color:       '#555',
    fontSize:    '12px',
    cursor:      'pointer',
    textAlign:   'center' as const,
    padding:     '4px',
    fontFamily:  'inherit',
  },
  footer: {
    position:      'relative',
    marginTop:     '20px',
    color:         '#333',
    fontSize:      '11px',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
}
