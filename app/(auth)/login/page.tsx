'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const redirect     = searchParams.get('redirect') ?? '/chat'
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res  = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
    const data = await res.json()
    if (!data.success) { setError(data.error); setLoading(false); return }
    router.push(redirect); router.refresh()
  }

  return (
    <div className="border border-[#2A2A2A] bg-[#111] p-8">
      <h1 className="text-white text-lg font-bold tracking-wide mb-1">Login</h1>
      <p className="text-[#555] text-sm mb-8">Masuk ke akun ANERS lu.</p>
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-[#888] text-xs tracking-widest uppercase mb-2">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-[#0A0A0A] border border-[#2A2A2A] text-white px-4 py-3 text-sm outline-none focus:border-[#FF5200] transition-colors" placeholder="nama@email.com" />
        </div>
        <div>
          <label className="block text-[#888] text-xs tracking-widest uppercase mb-2">Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-[#0A0A0A] border border-[#2A2A2A] text-white px-4 py-3 text-sm outline-none focus:border-[#FF5200] transition-colors" placeholder="••••••••" />
        </div>
        {error && <div className="border border-red-900 bg-red-900/10 px-4 py-3"><p className="text-red-400 text-sm">{error}</p></div>}
        <button type="submit" disabled={loading} className="w-full bg-[#FF5200] hover:bg-[#CC5500] disabled:bg-[#333] disabled:text-[#555] text-black font-bold py-3 text-sm tracking-widest uppercase transition-colors">
          {loading ? 'MEMPROSES...' : 'MASUK'}
        </button>
      </form>
      <div className="mt-8 pt-6 border-t border-[#1A1A1A]">
        <p className="text-[#444] text-sm text-center">Belum punya akun?{' '}<Link href="/register" className="text-[#FF5200] hover:text-[#CC5500] transition-colors">Daftar</Link></p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
      <div className="fixed inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#FF5200 1px, transparent 1px), linear-gradient(90deg, #FF5200 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="relative w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-8 border border-[#FF5200] rotate-45 flex items-center justify-center"><div className="w-3 h-3 bg-[#FF5200]" /></div>
            <span className="text-white text-2xl font-black tracking-[0.15em] uppercase">ANERS</span>
          </div>
          <p className="text-[#444] text-xs tracking-widest uppercase">Aria c11 — Intelligence Platform</p>
        </div>
        <Suspense fallback={<div className="border border-[#2A2A2A] bg-[#111] p-8 text-[#555] text-sm">Loading...</div>}>
          <LoginForm />
        </Suspense>
        <p className="text-center text-[#333] text-xs mt-6 tracking-widest uppercase">ANERS © 2025 — rixz-dev</p>
      </div>
    </div>
  )
}
