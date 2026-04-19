// app/api/files/generate/route.ts
// AI-powered file generation
// Aria menghasilkan file berdasarkan prompt, simpan ke Vercel Blob

export const runtime    = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { put }                       from '@vercel/blob'
import { getCurrentUser }            from '@/lib/auth/session'
import { checkToolSessionLimit }     from '@/lib/auth/roles'
import { createAdminClient }         from '@/lib/supabase/admin'
import { streamAria }                from '@/lib/ai/aria'
import type { FileType }             from '@/types'

const ALLOWED_FILETYPES: FileType[] = [
  'txt','sh','py','js','ts','css','html','php','json','md','env'
]

// ─── Extract code from AI output ─────────────────────────────────
function extractCode(aiOutput: string, fileType: string): string {
  // Cari code block yang paling relevan
  const codeBlockRegex = new RegExp(
    `\`\`\`(?:${fileType}|bash|sh|python|javascript|typescript|html|css|php|json|text|plain)?\\s*([\\s\\S]*?)\`\`\``,
    'gi'
  )
  const matches = [...aiOutput.matchAll(codeBlockRegex)]

  if (matches.length > 0) {
    // Ambil code block terpanjang
    return matches
      .map(m => m[1].trim())
      .sort((a, b) => b.length - a.length)[0]
  }

  // Fallback: strip markdown dan return raw
  return aiOutput
    .replace(/```[\w]*\n?/g, '')
    .replace(/```/g, '')
    .trim()
}

export async function POST(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 })
  }

  if (user.status === 'banned') {
    return NextResponse.json({ success: false, error: 'Akun kamu dibanned.' }, { status: 403 })
  }

  // ── Tool session limit ──────────────────────────────────────────
  const toolLimit = await checkToolSessionLimit(user.id, user.role)
  if (!toolLimit.allowed) {
    return NextResponse.json(
      { success: false, error: toolLimit.reason, resetIn: toolLimit.resetIn },
      { status: 429 }
    )
  }

  // ── Parse request ───────────────────────────────────────────────
  const body = await req.json()
  const {
    prompt,
    fileType = 'txt',
    filename,
    sessionId,
  } = body

  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ success: false, error: 'prompt wajib ada.' }, { status: 400 })
  }

  const safeType = ALLOWED_FILETYPES.includes(fileType as FileType)
    ? fileType as FileType
    : 'txt'

  const safeFilename = filename
    ? String(filename).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
    : `generated_${Date.now()}.${safeType}`

  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'NVIDIA_API_KEY tidak dikonfigurasi.' },
      { status: 500 }
    )
  }

  // ── Call Aria to generate content ───────────────────────────────
  const systemPrompt = `Kamu adalah Aria, AI yang ahli membuat file ${safeType}.
Tugas: generate file ${safeType} berdasarkan permintaan user.
PENTING: Output HANYA isi file dalam satu code block. Tidak perlu penjelasan.
Gunakan bahasa yang diminta dan best practices.`

  let ariaOutput = ''
  try {
    const result = await streamAria({
      messages: [
        { role: 'system',    content: systemPrompt },
        { role: 'user',      content: `Buat file ${safeType} ini:\n${prompt}` },
      ],
      apiKey,
      onToken: (t) => { ariaOutput += t },
    })
    ariaOutput = result.content
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: `AI error: ${msg}` }, { status: 500 })
  }

  // ── Extract actual file content ─────────────────────────────────
  const fileContent = extractCode(ariaOutput, safeType)
  const fileBuffer  = Buffer.from(fileContent, 'utf-8')
  const sizeBytes   = fileBuffer.byteLength

  // ── Upload to Vercel Blob ───────────────────────────────────────
  let storageUrl: string
  try {
    const blob = await put(
      `aners/${user.id}/${safeFilename}`,
      fileBuffer,
      {
        access:      'public',
        contentType: 'text/plain',
      }
    )
    storageUrl = blob.url
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { success: false, error: `Upload error: ${msg}` },
      { status: 500 }
    )
  }

  // ── Save record to DB ───────────────────────────────────────────
  const admin = createAdminClient()
  const { data: fileRecord, error: dbError } = await admin
    .from('files')
    .insert({
      user_id:      user.id,
      session_id:   sessionId ?? null,
      filename:     safeFilename,
      file_type:    safeType,
      size_bytes:   sizeBytes,
      storage_url:  storageUrl,
      is_encrypted: false,
      source:       'ai_generated',
    })
    .select('id, filename, file_type, size_bytes, storage_url, created_at')
    .single()

  if (dbError) {
    console.error('[files/generate] db error:', dbError)
    // Still return success — file is uploaded, just not recorded
  }

  return NextResponse.json({
    success: true,
    file: fileRecord ?? {
      filename:    safeFilename,
      file_type:   safeType,
      size_bytes:  sizeBytes,
      storage_url: storageUrl,
    },
    preview: fileContent.slice(0, 500),
  })
}
