// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { isIpBanned }                from '@/lib/auth/roles'

export async function POST(req: NextRequest) {
  try {
    const ip     = (req.headers.get('x-forwarded-for') ?? req.headers.get('x-client-ip') ?? 'unknown').split(',')[0].trim()
    if (await isIpBanned(ip)) return NextResponse.json({ success: false, error: 'Access denied.' }, { status: 403 })

    const { username, email, password } = await req.json()
    if (!username || !email || !password) return NextResponse.json({ success: false, error: 'Semua field wajib diisi.' }, { status: 400 })
    if (username.length < 3 || username.length > 24) return NextResponse.json({ success: false, error: 'Username harus 3-24 karakter.' }, { status: 400 })
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return NextResponse.json({ success: false, error: 'Username hanya huruf, angka, underscore.' }, { status: 400 })
    if (password.length < 8) return NextResponse.json({ success: false, error: 'Password minimal 8 karakter.' }, { status: 400 })

    const admin = createAdminClient()

    const { data: existing } = await admin.from('users').select('id').eq('username', username).single()
    if (existing) return NextResponse.json({ success: false, error: 'Username sudah dipakai.' }, { status: 409 })

    const { count } = await admin.from('users').select('id', { count: 'exact' }).eq('registered_ip', ip)
    if ((count ?? 0) >= 3) return NextResponse.json({ success: false, error: 'Terlalu banyak akun dari IP ini.' }, { status: 429 })

    const { data: authData, error: authError } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (authError || !authData.user) return NextResponse.json({ success: false, error: authError?.message ?? 'Gagal membuat akun.' }, { status: 400 })

    const { error: insertError } = await admin.from('users').insert({ username, email, supabase_uid: authData.user.id, role: 'free', status: 'active', registered_ip: ip, last_ip: ip })
    if (insertError) {
      await admin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ success: false, error: 'Gagal menyimpan data user.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Akun berhasil dibuat. Silakan login.' })
  } catch (err) {
    console.error('[register]', err)
    return NextResponse.json({ success: false, error: 'Server error.' }, { status: 500 })
  }
}
