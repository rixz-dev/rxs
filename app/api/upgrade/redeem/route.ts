// app/api/upgrade/redeem/route.ts
// User redeem upgrade code → role upgrade

import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis/client'
import { getCurrentUser }            from '@/lib/auth/session'
import { createAdminClient }         from '@/lib/supabase/admin'
import { sendTelegramAlert }         from '@/lib/security/telegram'


export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 })

  const body = await req.json()
  const { code } = body

  if (!code || typeof code !== 'string') {
    return NextResponse.json({ success: false, error: 'Code wajib diisi.' }, { status: 400 })
  }

  const cleanCode = code.trim().toUpperCase()
  const redisKey  = `upgrade:code:${cleanCode}`

  // Get code data
  const raw = await redis.get<string>(redisKey)
  if (!raw) {
    return NextResponse.json({ success: false, error: 'Code tidak valid atau sudah expired.' }, { status: 400 })
  }

  let codeData: { role: string; targetUsername: string; createdAt: string }
  try { codeData = JSON.parse(raw) } catch {
    return NextResponse.json({ success: false, error: 'Code rusak.' }, { status: 400 })
  }

  // Verify username match (case-insensitive)
  if (codeData.targetUsername && codeData.targetUsername !== user.username.toLowerCase()) {
    return NextResponse.json({ success: false, error: 'Code ini bukan untuk akun kamu.' }, { status: 403 })
  }

  // Apply role upgrade
  const admin = createAdminClient()
  const { error } = await admin
    .from('users')
    .update({ role: codeData.role, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ success: false, error: 'Gagal upgrade role.' }, { status: 500 })
  }

  // Invalidate code — one-time use
  await redis.del(redisKey)

  // Alert admin via Telegram
  await sendTelegramAlert(
    `✅ <b>Role Upgrade Berhasil</b>\n\n` +
    `User: <code>${user.username}</code>\n` +
    `Role baru: <b>${codeData.role.toUpperCase()}</b>\n` +
    `Code: <code>${cleanCode}</code>`
  )

  return NextResponse.json({
    success:  true,
    newRole:  codeData.role,
    message:  `Selamat! Role kamu sekarang ${codeData.role.toUpperCase()}.`,
  })
}
