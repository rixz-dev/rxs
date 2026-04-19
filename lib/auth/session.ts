import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient }          from '@/lib/supabase/admin'
import type { User }                  from '@/types'

export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null
    const admin = createAdminClient()
    const { data, error: dbError } = await admin.from('users').select('*').eq('supabase_uid', user.id).single()
    if (dbError || !data) return null
    return data as User
  } catch { return null }
}

export async function getUserByUid(uid: string): Promise<User | null> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.from('users').select('*').eq('supabase_uid', uid).single()
    if (error || !data) return null
    return data as User
  } catch { return null }
}

export async function touchUser(userId: string, ip: string) {
  try {
    const admin = createAdminClient()
    await admin.from('users').update({ last_seen_at: new Date().toISOString(), last_ip: ip }).eq('id', userId)
  } catch {}
}

export async function verifyAdminSession(req: import('next/server').NextRequest): Promise<boolean> {
  try {
    const token = req.cookies.get('admin_session')?.value
    if (!token) return false
    const { Redis } = await import('@upstash/redis')
    const url   = process.env.UPSTASH_REDIS_REST_URL
    const tokenR = process.env.UPSTASH_REDIS_REST_TOKEN
    if (!url || !tokenR) return false
    const redis = new Redis({ url, token: tokenR })
    const stored = await redis.get(`admin:session:${token}`)
    return !!stored
  } catch { return false }
}
