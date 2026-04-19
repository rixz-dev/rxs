import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { verifyAdminSession }        from '@/lib/auth/session'
import type { LogSeverity }          from '@/types'

export async function GET(req: NextRequest) {
  if (!await verifyAdminSession(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const page     = parseInt(searchParams.get('page')  ?? '1')
  const limit    = parseInt(searchParams.get('limit') ?? '50')
  const severity = searchParams.get('severity') ?? ''
  const offset   = (page - 1) * limit

  const admin = createAdminClient()
  let query = admin
    .from('admin_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (severity && ['info','warning','critical'].includes(severity)) {
    query = query.eq('severity', severity)
  }

  const { data, error, count } = await query
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, data: data ?? [], total: count ?? 0, page, limit })
}

export async function POST(req: NextRequest) {
  const internalKey = req.headers.get('x-internal-key')
  if (internalKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ success: false, error: 'Forbidden.' }, { status: 403 })
  }

  const body = await req.json()
  const admin = createAdminClient()

  const { error } = await admin.from('admin_logs').insert({
    user_id:        body.userId ?? null,
    ip_address:     body.ipAddress ?? '0.0.0.0',
    user_agent:     body.userAgent ?? null,
    request_path:   body.requestPath ?? null,
    request_method: body.requestMethod ?? null,
    severity:       (body.severity as LogSeverity) ?? 'info',
    event_type:     body.eventType ?? 'unknown',
    anomaly_score:  body.anomalyScore ?? 0,
    meta:           body.meta ?? {},
    action_taken:   body.actionTaken ?? null,
  })

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
