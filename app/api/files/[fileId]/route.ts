import { NextRequest, NextResponse } from 'next/server'
import { del }                       from '@vercel/blob'
import { getCurrentUser }            from '@/lib/auth/session'
import { createAdminClient }         from '@/lib/supabase/admin'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 })

  const { fileId } = await params
  const admin = createAdminClient()
  const { data: file } = await admin.from('files').select('storage_url, user_id').eq('id', fileId).single()

  if (!file) return NextResponse.json({ success: false, error: 'File tidak ditemukan.' }, { status: 404 })
  if (file.user_id !== user.id && user.role !== 'admin') return NextResponse.json({ success: false, error: 'Forbidden.' }, { status: 403 })

  return NextResponse.redirect(file.storage_url)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 })

  const { fileId } = await params
  const admin = createAdminClient()
  const { data: file } = await admin.from('files').select('storage_url, user_id').eq('id', fileId).single()

  if (!file) return NextResponse.json({ success: false, error: 'File tidak ditemukan.' }, { status: 404 })
  if (file.user_id !== user.id && user.role !== 'admin') return NextResponse.json({ success: false, error: 'Forbidden.' }, { status: 403 })

  try { await del(file.storage_url) } catch {}
  await admin.from('files').delete().eq('id', fileId)

  return NextResponse.json({ success: true })
}
