// app/api/chat/sessions/route.ts
// CRUD untuk chat sessions

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser }            from '@/lib/auth/session'
import { createAdminClient }         from '@/lib/supabase/admin'

// ── GET /api/chat/sessions — list user's sessions ────────────────
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const page  = parseInt(searchParams.get('page')  ?? '1')
  const limit = parseInt(searchParams.get('limit') ?? '20')
  const offset = (page - 1) * limit

  const admin = createAdminClient()
  const { data, error, count } = await admin
    .from('sessions')
    .select('id, title, dna_tags, token_count, status, created_at, last_message_at', { count: 'exact' })
    .eq('user_id', user.id)
    .neq('status', 'deleted')
    .order('last_message_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data:    data ?? [],
    total:   count ?? 0,
    page,
    limit,
  })
}

// ── POST /api/chat/sessions — create new session ─────────────────
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 })

  const body  = await req.json()
  const title = (body.title as string)?.trim() || 'New Chat'

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sessions')
    .insert({
      user_id:       user.id,
      title:         title.slice(0, 100),
      status:        'active',
      dna_tags:      [],
      token_count:   0,
      context_limit: 128000,
    })
    .select('id, title, status, created_at')
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data })
}

// ── PATCH /api/chat/sessions — update session title ──────────────
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 })

  const body  = await req.json()
  const { sessionId, title, status } = body

  if (!sessionId) {
    return NextResponse.json({ success: false, error: 'sessionId wajib ada.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify ownership
  const { data: session } = await admin
    .from('sessions')
    .select('user_id')
    .eq('id', sessionId)
    .single()

  if (!session || session.user_id !== user.id) {
    return NextResponse.json({ success: false, error: 'Session tidak ditemukan.' }, { status: 404 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (title)  updates.title  = String(title).slice(0, 100)
  if (status && ['active', 'archived', 'deleted'].includes(status)) {
    updates.status = status
  }

  const { error } = await admin
    .from('sessions')
    .update(updates)
    .eq('id', sessionId)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// ── DELETE /api/chat/sessions — soft delete ───────────────────────
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('sessionId')

  if (!sessionId) {
    return NextResponse.json({ success: false, error: 'sessionId wajib ada.' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify ownership
  const { data: session } = await admin
    .from('sessions')
    .select('user_id')
    .eq('id', sessionId)
    .single()

  if (!session || session.user_id !== user.id) {
    return NextResponse.json({ success: false, error: 'Session tidak ditemukan.' }, { status: 404 })
  }

  // Soft delete
  const { error } = await admin
    .from('sessions')
    .update({ status: 'deleted', updated_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
