import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis/client'
import { verifyAdminOtp }            from '@/lib/security/telegram'
import { nanoid }                    from 'nanoid'


export async function POST(req: NextRequest) {
  try {
    const ip = (req.headers.get('x-forwarded-for') ?? '0.0.0.0').split(',')[0].trim()
    const step1 = await redis.get(`admin:step1:${ip}`)
    if (!step1) return NextResponse.json({ success: false, error: 'Step 1 belum selesai.' }, { status: 403 })

    const { otp } = await req.json()
    if (!otp) return NextResponse.json({ success: false, error: 'OTP wajib.' }, { status: 400 })

    const valid = await verifyAdminOtp(otp)
    if (!valid) return NextResponse.json({ success: false, error: 'OTP salah atau expired.' }, { status: 401 })

    await redis.del(`admin:step1:${ip}`)
    const sessionToken = nanoid(48)
    await redis.setex(`admin:session:${sessionToken}`, 3600, ip)

    const res = NextResponse.json({ success: true })
    res.cookies.set('admin_session', sessionToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 3600, path: '/admin' })
    return res
  } catch (err) {
    console.error('[admin/tfa]', err)
    return NextResponse.json({ success: false, error: 'Server error.' }, { status: 500 })
  }
}
