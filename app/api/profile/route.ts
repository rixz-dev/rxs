// app/api/profile/route.ts
// Endpoint untuk ambil data profil user yang sedang login
// FIX: Sebelumnya profile diambil dari /api/chat/sessions yang tidak
// pernah return field 'user' atau 'profile' — sehingga profile state
// di chat page tidak pernah ter-set dan panel profile selalu "Loading..."

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser }            from '@/lib/auth/session'
import { createAdminClient }         from '@/lib/supabase/admin'

export async function GET(_req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 })
    }

    // Ambil chat count hari ini dari DB (fresh count, bukan dari session cache)
    const admin = createAdminClient()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { count } = await admin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('role', 'user')
      .gte('created_at', today.toISOString())

    return NextResponse.json({
      success: true,
      data: {
        username:        user.username,
        email:           user.email ?? null,
        role:            user.role,
        chat_count_today: count ?? user.chat_count_today ?? 0,
        last_seen_at:    user.last_seen_at,
        created_at:      user.created_at,
      },
    })
  } catch (err: unknown) {
    console.error('[api/profile]', err)
    return NextResponse.json({ success: false, error: 'Server error.' }, { status: 500 })
  }
}
