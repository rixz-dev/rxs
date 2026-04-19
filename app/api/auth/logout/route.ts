// app/api/auth/logout/route.ts
// ── FIX [C3]: await createServerSupabaseClient()
import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    await supabase.auth.signOut()
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Logout failed.' }, { status: 500 })
  }
}
