// app/api/admin/ban/route.ts
// Ban / unban IP address dan user

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { verifyAdminSession }        from '@/lib/auth/session'
import { banIpRedis }                from '@/lib/auth/roles'
import { redis } from '@/lib/redis/client'


// ── POST /api/admin/ban ───────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!await verifyAdminSession(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 })
  }

  const body = await req.json()
  const { action, target, targetType, ttlSeconds, reason } = body
  // action: 'ban' | 'unban'
  // targetType: 'ip' | 'user'
  // target: IP string atau userId string

  if (!action || !target || !targetType) {
    return NextResponse.json(
      { success: false, error: 'action, target, targetType wajib ada.' },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  if (targetType === 'ip') {
    if (action === 'ban') {
      await banIpRedis(target, ttlSeconds)
      return NextResponse.json({ success: true, message: `IP ${target} dibanned.` })
    }
    if (action === 'unban') {
      await redis.del(`ban:ip:${target}`)
      return NextResponse.json({ success: true, message: `IP ${target} di-unban.` })
    }
  }

  if (targetType === 'user') {
    const newStatus = action === 'ban' ? 'banned' : 'active'

    const { data: user } = await admin
      .from('users')
      .select('username, last_ip, registered_ip')
      .eq('id', target)
      .single()

    if (!user) {
      return NextResponse.json({ success: false, error: 'User tidak ditemukan.' }, { status: 404 })
    }

    const { error } = await admin
      .from('users')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', target)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Juga ban/unban IP-nya
    if (action === 'ban') {
      if (user.last_ip)       await redis.set(`ban:ip:${user.last_ip}`, '1')
      if (user.registered_ip) await redis.set(`ban:ip:${user.registered_ip}`, '1')
    } else {
      if (user.last_ip)       await redis.del(`ban:ip:${user.last_ip}`)
      if (user.registered_ip) await redis.del(`ban:ip:${user.registered_ip}`)
    }

    return NextResponse.json({
      success: true,
      message: `User ${user.username} ${action === 'ban' ? 'dibanned' : 'di-unban'}.`,
    })
  }

  return NextResponse.json({ success: false, error: 'targetType tidak valid.' }, { status: 400 })
}

// ── GET /api/admin/ban — list banned IPs from Redis ──────────────
export async function GET(req: NextRequest) {
  if (!await verifyAdminSession(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 })
  }

  // Scan Redis untuk semua ban:ip:* keys
  let cursor = 0
  const bannedIps: string[] = []

  do {
    const [nextCursor, keys] = await redis.scan(cursor, { match: 'ban:ip:*', count: 100 })
    cursor = Number(nextCursor)
    for (const key of keys) {
      bannedIps.push(key.replace('ban:ip:', ''))
    }
  } while (cursor !== 0)

  return NextResponse.json({ success: true, data: bannedIps })
}
