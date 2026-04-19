// app/api/admin/users/route.ts
// Admin: manage users — list, update role, ban/unban

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { verifyAdminSession }        from '@/lib/auth/session'
import { redis } from '@/lib/redis/client'
import { sendTelegramAlert }         from '@/lib/security/telegram'


// ── GET /api/admin/users — list users with pagination + search ────
export async function GET(req: NextRequest) {
  if (!await verifyAdminSession(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const page    = parseInt(searchParams.get('page')   ?? '1')
  const limit   = parseInt(searchParams.get('limit')  ?? '25')
  const search  = searchParams.get('search')  ?? ''
  const role    = searchParams.get('role')    ?? ''
  const status  = searchParams.get('status')  ?? ''
  const offset  = (page - 1) * limit

  const admin = createAdminClient()
  let query = admin
    .from('users')
    .select('id, username, email, role, status, last_ip, registered_ip, chat_count_today, created_at, last_seen_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%`)
  }
  if (role)   query = query.eq('role',   role)
  if (status) query = query.eq('status', status)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: data ?? [], total: count ?? 0, page, limit })
}

// ── PATCH /api/admin/users — update role or status ───────────────
export async function PATCH(req: NextRequest) {
  if (!await verifyAdminSession(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 })
  }

  const body = await req.json()
  const { userId, role, status, reason } = body

  if (!userId) {
    return NextResponse.json({ success: false, error: 'userId wajib ada.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Get current user info
  const { data: user } = await admin
    .from('users')
    .select('username, role, status, last_ip')
    .eq('id', userId)
    .single()

  if (!user) {
    return NextResponse.json({ success: false, error: 'User tidak ditemukan.' }, { status: 404 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const changes: string[] = []

  if (role && ['free', 'pro', 'max'].includes(role)) {
    updates.role = role
    changes.push(`role: ${user.role} → ${role}`)
  }

  if (status && ['active', 'banned', 'shadow'].includes(status)) {
    updates.status = status
    changes.push(`status: ${user.status} → ${status}`)

    // Jika ban → also ban IP di Redis
    if (status === 'banned' && user.last_ip) {
      await redis.set(`ban:ip:${user.last_ip}`, '1')
    }
    // Jika unban → remove IP ban
    if (status === 'active' && user.last_ip) {
      await redis.del(`ban:ip:${user.last_ip}`)
    }
  }

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ success: false, error: 'Tidak ada perubahan yang valid.' }, { status: 400 })
  }

  const { error } = await admin
    .from('users')
    .update(updates)
    .eq('id', userId)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  // Telegram alert untuk ban action
  if (status === 'banned') {
    await sendTelegramAlert(
      `🚫 <b>User Dibanned</b>\n\n` +
      `Username: <code>${user.username}</code>\n` +
      `IP: <code>${user.last_ip ?? 'unknown'}</code>\n` +
      `Reason: ${reason ?? 'tidak disebutkan'}`
    )
  }

  return NextResponse.json({
    success: true,
    message: `Updated: ${changes.join(', ')}`,
  })
}
