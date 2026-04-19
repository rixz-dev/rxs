'use client'
// app/page.tsx — ANERS Landing Page

import Link from 'next/link'

const FEATURES = [
  { icon: '⟳', title: 'Agentic Loop',    desc: 'Aria generate, Nexus kritik, loop sampai sempurna. Otomatis tanpa intervensi.' },
  { icon: '◈', title: 'Dual AI',         desc: 'minimax-m2.7 sebagai builder. deepseek-v3.2 dengan chain-of-thought sebagai reviewer.' },
  { icon: '▦', title: 'File Generation', desc: 'AI generate file txt, py, sh, js, html, css, php, json, md langsung download.' },
  { icon: '◉', title: 'Think Blocks',    desc: 'Reasoning chain tersembunyi, bisa dibuka. Lihat AI berpikir sebelum menjawab.' },
  { icon: '▣', title: 'Role System',     desc: 'Free, Pro, Max. Rate limit cerdas per role. Upgrade via Telegram.' },
  { icon: '◐', title: 'Admin Panel',     desc: 'Dashboard monitoring, 2FA Telegram, ban/unban, security patrol realtime.' },
]

const PLANS = [
  { name: 'Free', price: 'Gratis', color: '#555', chat: '10', tools: '7', highlight: false,
    perks: ['10 chat per 2 jam', '7 tool sessions per hari', 'Akses semua model', 'Chat history', 'File download'] },
  { name: 'Pro', price: 'Rp 15.000', per: '/bulan', color: '#3b82f6', chat: '20', tools: '15', highlight: false,
    perks: ['20 chat per 2 jam', '15 tool sessions per hari', 'Prioritas response', 'File generation unlimited', 'API key access'] },
  { name: 'Max', price: 'Rp 25.000', per: '/2 bulan', color: '#FF5200', chat: '40', tools: '∞', highlight: true,
    perks: ['40 chat per 3 jam', 'Tool sessions unlimited', 'Semua fitur Pro', 'Agent loop unlimited', 'Priority support'] },
]

export default function LandingPage() {
  return (
    <div style={S.page}>
      <div style={S.grid} />

      {/* Nav */}
      <nav style={S.nav}>
        <div style={S.navLogo}>
          <div style={S.logoIcon}><div style={S.logoDot}/></div>
          <span style={S.logoText}>ANERS</span>
        </div>
        <div style={S.navLinks}>
          <Link href="/docs" style={S.navLink}>Docs</Link>
          <Link href="/login" style={S.navLink}>Login</Link>
          <Link href="/register" style={S.navCta}>Mulai Gratis</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={S.hero}>
        <div style={S.heroInner}>
          <div style={S.heroBadge}>Aria c11 · Powered by NVIDIA Build API</div>
          <h1 style={S.heroTitle}>
            AI yang<br />
            <span style={{ color: '#FF5200' }}>bekerja sampai<br />selesai.</span>
          </h1>
          <p style={S.heroSub}>
            Dua AI dalam satu platform — Aria sebagai builder,
            Nexus sebagai reviewer. Loop otomatis sampai hasilnya sempurna.
          </p>
          <div style={S.heroBtns}>
            <Link href="/register" style={S.btnPrimary}>Coba Gratis →</Link>
            <Link href="/docs"     style={S.btnSecondary}>API Docs</Link>
          </div>
          <p style={S.heroNote}>Free selamanya. Upgrade kapan saja.</p>
        </div>

        {/* Live demo preview */}
        <div style={S.heroDemo}>
          <div style={S.demoWindow}>
            <div style={S.demoBar}>
              <div style={S.demoDots}>
                <span style={{ ...S.demoDot, background: '#ef4444' }}/>
                <span style={{ ...S.demoDot, background: '#f59e0b' }}/>
                <span style={{ ...S.demoDot, background: '#22c55e' }}/>
              </div>
              <span style={S.demoTitle}>ANERS — Aria c11</span>
            </div>
            <div style={S.demoBody}>
              <div style={S.demoMsg}>
                <span style={S.demoUser}>you</span>
                <div style={S.demoBubble}>Buat REST API Python dengan Flask + JWT auth</div>
              </div>
              <div style={{ ...S.demoMsg, flexDirection: 'row-reverse' }}>
                <span style={{ ...S.demoUser, color: '#FF5200' }}>aria</span>
                <div style={{ ...S.demoBubble, background: '#0f0f12', borderColor: '#1e1e2e' }}>
                  <div style={{ color: '#888', fontSize: '11px', marginBottom: '8px' }}>▸ iteration 1 · generating...</div>
                  <code style={{ color: '#7dd3fc', fontSize: '11px' }}>from flask import Flask, jsonify</code>
                  <span style={{ display: 'inline-block', width: '2px', height: '12px', background: '#FF5200', marginLeft: '2px', animation: 'blink 1s infinite' }}/>
                </div>
              </div>
              <div style={S.demoMsg}>
                <span style={{ ...S.demoUser, color: '#818cf8' }}>nexus</span>
                <div style={S.demoBubble}>
                  <span style={{ color: '#22c55e', fontSize: '11px', fontWeight: 700 }}>✓ APPROVED</span>
                  <div style={{ color: '#555', fontSize: '11px', marginTop: '4px' }}>Code lengkap, JWT implementation correct.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={S.section}>
        <div style={S.sectionInner}>
          <h2 style={S.sectionTitle}>Semua yang lo butuhkan</h2>
          <div style={S.featureGrid}>
            {FEATURES.map(f => (
              <div key={f.title} style={S.featureCard}>
                <div style={S.featureIcon}>{f.icon}</div>
                <div style={S.featureTitle}>{f.title}</div>
                <div style={S.featureDesc}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section style={{ ...S.section, background: '#050505' }}>
        <div style={S.sectionInner}>
          <h2 style={S.sectionTitle}>Pricing</h2>
          <p style={{ textAlign: 'center', color: '#555', fontSize: '13px', marginBottom: '32px' }}>
            Upgrade via Telegram <a href="https://t.me/fourhoundredfour_404" style={{ color: '#FF5200' }} target="_blank" rel="noopener noreferrer">@fourhoundredfour_404</a>
          </p>
          <div style={S.pricingGrid}>
            {PLANS.map(plan => (
              <div key={plan.name} style={{ ...S.pricingCard, ...(plan.highlight ? S.pricingHighlight : {}) }}>
                {plan.highlight && <div style={S.bestBadge}>TERPOPULER</div>}
                <div style={{ color: plan.color, fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', marginBottom: '8px' }}>
                  {plan.name.toUpperCase()}
                </div>
                <div style={S.pricingPrice}>
                  {plan.price}
                  {plan.per && <span style={{ color: '#555', fontSize: '13px' }}>{plan.per}</span>}
                </div>
                <ul style={S.perkList}>
                  {plan.perks.map(p => (
                    <li key={p} style={S.perkItem}>
                      <span style={{ color: plan.color, marginRight: '8px' }}>✓</span>{p}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.name === 'Free' ? '/register' : 'https://t.me/fourhoundredfour_404'}
                  style={{ ...S.pricingBtn, borderColor: plan.color, color: plan.highlight ? '#000' : plan.color, background: plan.highlight ? plan.color : 'transparent' }}
                  target={plan.name !== 'Free' ? '_blank' : undefined}
                  rel={plan.name !== 'Free' ? 'noopener noreferrer' : undefined}
                >
                  {plan.name === 'Free' ? 'Daftar Gratis' : 'Upgrade via Telegram'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={S.cta}>
        <div style={S.ctaInner}>
          <h2 style={{ ...S.sectionTitle, marginBottom: '12px' }}>Siap mulai?</h2>
          <p style={{ color: '#555', fontSize: '14px', marginBottom: '28px' }}>
            Daftar gratis, langsung pakai. Tidak perlu kartu kredit.
          </p>
          <Link href="/register" style={S.btnPrimary}>Buat Akun Gratis →</Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={S.footer}>
        <div style={S.footerInner}>
          <div style={S.navLogo}>
            <div style={S.logoIcon}><div style={S.logoDot}/></div>
            <span style={S.logoText}>ANERS</span>
          </div>
          <div style={S.footerLinks}>
            <Link href="/docs"  style={S.footerLink}>API Docs</Link>
            <Link href="/login" style={S.footerLink}>Login</Link>
            <a href="https://t.me/fourhoundredfour_404" style={S.footerLink} target="_blank" rel="noopener noreferrer">Telegram</a>
            <a href="https://github.com/rixz-dev" style={S.footerLink} target="_blank" rel="noopener noreferrer">GitHub</a>
          </div>
          <p style={{ color: '#333', fontSize: '12px' }}>© 2025 ANERS · rixz-dev</p>
        </div>
      </footer>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page:       { minHeight: '100vh', background: '#080808', color: '#ccc', fontFamily: 'inherit', overflowX: 'hidden', position: 'relative' },
  grid:       { position: 'fixed', inset: 0, opacity: 0.025, backgroundImage: 'linear-gradient(#FF5200 1px, transparent 1px), linear-gradient(90deg, #FF5200 1px, transparent 1px)', backgroundSize: '60px 60px', pointerEvents: 'none' },

  nav:        { position: 'sticky', top: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', background: 'rgba(8,8,8,.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #1a1a1a' },
  navLogo:    { display: 'flex', alignItems: 'center', gap: '10px' },
  logoIcon:   { width: '26px', height: '26px', border: '1px solid #FF5200', transform: 'rotate(45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoDot:    { width: '9px', height: '9px', background: '#FF5200' },
  logoText:   { color: '#fff', fontWeight: 900, letterSpacing: '0.2em', fontSize: '15px' },
  navLinks:   { display: 'flex', alignItems: 'center', gap: '20px' },
  navLink:    { color: '#666', fontSize: '13px', textDecoration: 'none' },
  navCta:     { background: '#FF5200', color: '#000', padding: '7px 16px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textDecoration: 'none' },

  hero:       { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '48px', padding: '80px 24px 60px', maxWidth: '1100px', margin: '0 auto', flexWrap: 'wrap' },
  heroInner:  { flex: '1 1 380px', maxWidth: '480px' },
  heroBadge:  { display: 'inline-block', background: 'rgba(255,82,0,.08)', border: '1px solid rgba(255,82,0,.25)', color: '#FF5200', fontSize: '11px', padding: '4px 12px', letterSpacing: '0.08em', marginBottom: '20px' },
  heroTitle:  { color: '#fff', fontSize: 'clamp(32px,5vw,52px)', fontWeight: 900, lineHeight: 1.1, margin: '0 0 20px', letterSpacing: '-0.01em' },
  heroSub:    { color: '#666', fontSize: '15px', lineHeight: 1.8, margin: '0 0 28px' },
  heroBtns:   { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' },
  heroNote:   { color: '#444', fontSize: '12px', margin: 0 },

  heroDemo:   { flex: '1 1 340px', maxWidth: '440px' },
  demoWindow: { background: '#0a0a0a', border: '1px solid #1e1e1e', overflow: 'hidden' },
  demoBar:    { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: '1px solid #1a1a1a', background: '#0f0f0f' },
  demoDots:   { display: 'flex', gap: '5px' },
  demoDot:    { width: '8px', height: '8px', borderRadius: '50%' },
  demoTitle:  { color: '#444', fontSize: '11px', letterSpacing: '0.08em' },
  demoBody:   { padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' },
  demoMsg:    { display: 'flex', alignItems: 'flex-start', gap: '10px' },
  demoUser:   { color: '#555', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', whiteSpace: 'nowrap', paddingTop: '2px', minWidth: '34px' },
  demoBubble: { background: '#111', border: '1px solid #1e1e1e', padding: '10px 12px', fontSize: '12px', lineHeight: 1.6, flex: 1 },

  btnPrimary:   { background: '#FF5200', color: '#000', padding: '11px 22px', fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', textDecoration: 'none', display: 'inline-block' },
  btnSecondary: { background: 'transparent', color: '#888', border: '1px solid #2a2a2a', padding: '10px 20px', fontSize: '13px', textDecoration: 'none', display: 'inline-block' },

  section:      { padding: '64px 0', position: 'relative' },
  sectionInner: { maxWidth: '1000px', margin: '0 auto', padding: '0 24px' },
  sectionTitle: { color: '#fff', fontSize: 'clamp(20px,3vw,28px)', fontWeight: 900, letterSpacing: '-0.01em', textAlign: 'center', margin: '0 0 40px' },

  featureGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: '16px' },
  featureCard: { background: '#0a0a0a', border: '1px solid #1a1a1a', padding: '20px' },
  featureIcon: { fontSize: '20px', color: '#FF5200', marginBottom: '12px' },
  featureTitle: { color: '#fff', fontWeight: 700, marginBottom: '8px', fontSize: '14px' },
  featureDesc:  { color: '#666', fontSize: '13px', lineHeight: 1.6 },

  pricingGrid:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: '16px', alignItems: 'start' },
  pricingCard:      { background: '#0a0a0a', border: '1px solid #1a1a1a', padding: '24px', position: 'relative', overflow: 'hidden' },
  pricingHighlight: { border: '1px solid rgba(255,82,0,.4)', background: '#0d0a08' },
  bestBadge:        { position: 'absolute', top: '12px', right: '12px', background: '#FF5200', color: '#000', fontSize: '9px', fontWeight: 900, letterSpacing: '0.1em', padding: '3px 8px' },
  pricingPrice:     { color: '#fff', fontSize: '22px', fontWeight: 900, marginBottom: '16px', display: 'flex', alignItems: 'baseline', gap: '4px' },
  perkList:         { listStyle: 'none', padding: 0, margin: '0 0 20px', display: 'flex', flexDirection: 'column', gap: '8px' },
  perkItem:         { color: '#888', fontSize: '13px', display: 'flex', alignItems: 'flex-start' },
  pricingBtn:       { display: 'block', textAlign: 'center', border: '1px solid', padding: '10px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textDecoration: 'none' },

  cta:        { padding: '80px 24px', textAlign: 'center' },
  ctaInner:   { maxWidth: '500px', margin: '0 auto' },

  footer:       { borderTop: '1px solid #111', padding: '32px 24px' },
  footerInner:  { maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' },
  footerLinks:  { display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' },
  footerLink:   { color: '#444', fontSize: '13px', textDecoration: 'none' },
}
