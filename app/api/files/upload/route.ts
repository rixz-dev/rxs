// app/api/files/upload/route.ts
// User file upload — multipart form → Vercel Blob

import { NextRequest, NextResponse } from 'next/server'
import { put }                       from '@vercel/blob'
import { getCurrentUser }            from '@/lib/auth/session'
import { checkToolSessionLimit }     from '@/lib/auth/roles'
import { createAdminClient }         from '@/lib/supabase/admin'
import type { FileType }             from '@/types'

const ALLOWED_EXTENSIONS: Record<string, FileType> = {
  txt: 'txt', sh: 'sh', py: 'py', js: 'js', ts: 'js', css: 'css',
  html: 'html', php: 'php', json: 'txt', md: 'txt', env: 'env',
  jpg: 'jpg', jpeg: 'jpg', png: 'png',
}

const MAX_SIZE_BYTES = 5 * 1024 * 1024   // 5MB

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 })
  }

  const toolLimit = await checkToolSessionLimit(user.id, user.role)
  if (!toolLimit.allowed) {
    return NextResponse.json(
      { success: false, error: toolLimit.reason },
      { status: 429 }
    )
  }

  const formData  = await req.formData()
  const file      = formData.get('file')
  const sessionId = formData.get('sessionId') as string | null

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ success: false, error: 'File tidak ditemukan.' }, { status: 400 })
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { success: false, error: `File terlalu besar. Max ${MAX_SIZE_BYTES / 1024 / 1024}MB.` },
      { status: 413 }
    )
  }

  // Get extension
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const fileType = ALLOWED_EXTENSIONS[ext]

  if (!fileType) {
    return NextResponse.json(
      { success: false, error: `Tipe file .${ext} tidak diizinkan.` },
      { status: 400 }
    )
  }

  const safeName  = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
  const arrayBuf  = await file.arrayBuffer()
  const buffer    = Buffer.from(arrayBuf)

  let storageUrl: string
  try {
    const blob = await put(
      `aners/${user.id}/uploads/${safeName}`,
      buffer,
      { access: 'public', contentType: file.type || 'application/octet-stream' }
    )
    storageUrl = blob.url
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: `Upload gagal: ${msg}` }, { status: 500 })
  }

  const admin = createAdminClient()
  const { data: record } = await admin
    .from('files')
    .insert({
      user_id:      user.id,
      session_id:   sessionId ?? null,
      filename:     safeName,
      file_type:    fileType,
      size_bytes:   file.size,
      storage_url:  storageUrl,
      is_encrypted: false,
      source:       'user_upload',
    })
    .select('id, filename, file_type, size_bytes, storage_url, created_at')
    .single()

  return NextResponse.json({ success: true, file: record })
}
