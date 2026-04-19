// app/api/keys/revoke/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { getCurrentUser }            from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 })

  const { keyId } = await req.json()
  if (!keyId) return NextResponse.json({ success: false, error: 'keyId wajib ada.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: key } = await admin.from('api_keys').select('user_id').eq('id', keyId).single()
  if (!key || key.user_id !== user.id) return NextResponse.json({ success: false, error: 'Key tidak ditemukan.' }, { status: 404 })

  await admin.from('api_keys').update({ status: 'revoked' }).eq('id', keyId)
  return NextResponse.json({ success: true })
}
