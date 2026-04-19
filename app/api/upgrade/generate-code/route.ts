// app/api/upgrade/generate-code/route.ts
// Admin generates a one-time upgrade code via Telegram bot
// User DM ke Telegram @fourhoundredfour_404 → bot generates code → user redeem di app

import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis/client'
import { nanoid }                    from 'nanoid'
import { verifyAdminSession }        from '@/lib/auth/session'


// This route is also called by the Telegram bot webhook
// Verify via TELEGRAM_ADMIN_CHAT_ID match OR admin session cookie

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { targetUsername, role, callerChatId, adminCookieBypass } = body

  // Allow if: valid admin session cookie OR request comes from authorized Telegram chat
  const isAdminSession = adminCookieBypass && await verifyAdminSession(req)
  const isTelegramBot  = String(callerChatId) === process.env.TELEGRAM_ADMIN_CHAT_ID

  if (!isAdminSession && !isTelegramBot) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 })
  }

  if (!targetUsername || !role) {
    return NextResponse.json({ success: false, error: 'targetUsername dan role wajib ada.' }, { status: 400 })
  }

  if (!['pro', 'max'].includes(role)) {
    return NextResponse.json({ success: false, error: 'Role harus "pro" atau "max".' }, { status: 400 })
  }

  // Generate code: ANERS-XXXXXXXXXXXX (12 chars uppercase alphanum)
  const code = `ANERS-${nanoid(12).toUpperCase()}`

  // Store in Redis: key = upgrade:code:<code>, value = {role, targetUsername, createdAt}
  // TTL: 7 hari
  await redis.setex(
    `upgrade:code:${code}`,
    604800,
    JSON.stringify({ role, targetUsername: targetUsername.toLowerCase(), createdAt: new Date().toISOString() })
  )

  return NextResponse.json({ success: true, code, role, targetUsername, expiresIn: '7 days' })
}
