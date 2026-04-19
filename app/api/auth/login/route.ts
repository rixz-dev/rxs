// app/api/auth/login/route.ts
// ── FIX [C3]: await createServerSupabaseClient()
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isIpBanned }                from '@/lib/auth/roles'
import { redis }                     from '@/lib/redis/client'

export async function POST(req: NextRequest) {
  try {
    const ip = (req.headers.get('x-forwarded-for') ?? req.headers.get('x-client-ip') ?? 'unknown').split(',')[0].trim()
    if (await isIpBanned(ip)) return NextResponse.json({ success: false, error: 'Access denied.' }, { status: 403 })

    const failKey   = `login:fail:${ip}`
    const failCount = (await redis.get<number>(failKey)) ?? 0
    if (failCount >= 5) return NextResponse.json({ success: false, error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' }, { status: 429 })

    const { email, password } = await req.json()
    if (!email || !password) return NextResponse.json({ success: false, error: 'Email dan password wajib diisi.' }, { status: 400 })

    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) {
      await redis.setex(failKey, 900, failCount + 1)
      return NextResponse.json({ success: false, error: 'Email atau password salah.' }, { status: 401 })
    }

    await redis.del(failKey)
    const admin = createAdminClient()
    const { data: profile } = await admin.from('users').select('id, username, role, status').eq('supabase_uid', data.user.id).single()
    if (!profile) return NextResponse.json({ success: false, error: 'User profile tidak ditemukan.' }, { status: 404 })
    if (profile.status === 'banned') { await supabase.auth.signOut(); return NextResponse.json({ success: false, error: 'Akun ini telah dibanned.' }, { status: 403 }) }

    await admin.from('users').update({ last_ip: ip, last_seen_at: new Date().toISOString() }).eq('id', profile.id)
    return NextResponse.json({ success: true, user: { id: profile.id, username: profile.username, role: profile.role } })
  } catch (err) {
    console.error('[login]', err)
    return NextResponse.json({ success: false, error: 'Server error.' }, { status: 500 })
  }
}
