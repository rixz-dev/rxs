// app/api/keys/generate/route.ts
// Generate API key untuk external access

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient }         from '@/lib/supabase/admin'
import { getCurrentUser }            from '@/lib/auth/session'
import { nanoid }                    from 'nanoid'

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 })

  const ip  = req.headers.get('x-client-ip') ?? req.headers.get('x-forwarded-for') ?? '0.0.0.0'
  const raw = `anrs_${nanoid(40)}`
  const hash   = await sha256hex(raw)
  const prefix = raw.slice(0, 12)   // "anrs_XXXXXXX" — shown once to user

  const admin = createAdminClient()

  // Check existing key count — max 3 per user
  const { count } = await admin.from('api_keys').select('id', { count: 'exact' }).eq('user_id', user.id).eq('status', 'active')
  if ((count ?? 0) >= 3) {
    return NextResponse.json({ success: false, error: 'Maksimal 3 API key aktif. Revoke yang lama dulu.' }, { status: 429 })
  }

  const { data, error } = await admin.from('api_keys').insert({
    user_id:          user.id,
    key_hash:         hash,
    key_prefix:       prefix,
    status:           'active',
    created_from_ip:  ip,
    total_requests:   0,
    total_tokens:     0,
    endpoints_hit:    [],
    anomaly_score:    0,
  }).select('id, key_prefix, status, created_at').single()

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  // Return raw key ONCE — not stored, only hash kept
  return NextResponse.json({ success: true, key: raw, data })
}
