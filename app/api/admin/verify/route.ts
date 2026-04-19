// app/api/admin/verify/route.ts
// Admin 2FA — Step 1: password check
// Jika password benar → kirim OTP ke Telegram admin

import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis/client'
import { sendAdminOtp }              from '@/lib/security/telegram'


// SHA-256 hash dari password admin
// Dari spec: bc82f7741ed40ed4d0b2f66b0154eb7402713c34de0ca1dc984e938200dbf198
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH
  ?? 'bc82f7741ed40ed4d0b2f66b0154eb7402713c34de0ca1dc984e938200dbf198'

// ─── SHA-256 via Web Crypto (Edge/Node compatible) ────────────────
async function sha256(text: string): Promise<string> {
  const enc  = new TextEncoder()
  const data = enc.encode(text)
  const buf  = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function POST(req: NextRequest) {
  try {
    const ip = (req.headers.get('x-forwarded-for') ?? req.headers.get('x-client-ip') ?? '0.0.0.0')
      .split(',')[0].trim()

    // Brute force protection — 3 fails = 30 min lockout
    const failKey   = `admin:fail:${ip}`
    const failCount = (await redis.get<number>(failKey)) ?? 0

    if (failCount >= 3) {
      return NextResponse.json(
        { success: false, error: 'Terlalu banyak percobaan. Coba lagi dalam 30 menit.' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const { password } = body

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Password wajib diisi.' },
        { status: 400 }
      )
    }

    const inputHash = await sha256(password)

    if (inputHash !== ADMIN_PASSWORD_HASH) {
      // Increment fail counter — 30 min window
      await redis.setex(failKey, 1800, failCount + 1)
      return NextResponse.json(
        { success: false, error: 'Password salah.' },
        { status: 401 }
      )
    }

    // Password correct — reset fail counter
    await redis.del(failKey)

    // Send OTP to Telegram
    const result = await sendAdminOtp()
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: `Gagal kirim OTP: ${result.error}` },
        { status: 500 }
      )
    }

    // Mark this IP as "passed step 1" — valid for 10 minutes
    await redis.setex(`admin:step1:${ip}`, 600, '1')

    return NextResponse.json({
      success: true,
      message: 'Kode verifikasi dikirim ke Telegram.',
    })

  } catch (err: unknown) {
    console.error('[admin/verify]', err)
    return NextResponse.json(
      { success: false, error: 'Server error.' },
      { status: 500 }
    )
  }
}
