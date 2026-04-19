import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 })
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('api_keys')
    .select('id, key_prefix, status, created_at, total_requests, total_tokens')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data: data ?? [] })
}
