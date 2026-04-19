import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function ChatIndexPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Cek apakah ada session aktif terakhir
  const { data: lastSession } = await admin
    .from('sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('last_message_at', { ascending: false })
    .limit(1)
    .single()

  if (lastSession) {
    redirect(`/chat/${lastSession.id}`)
  }

  // Buat session baru
  const { data: newSession, error } = await admin
    .from('sessions')
    .insert({
      user_id:       user.id,
      title:         'New Chat',
      status:        'active',
      dna_tags:      [],
      token_count:   0,
      context_limit: 128000,
    })
    .select('id')
    .single()

  if (error || !newSession) redirect('/login')

  redirect(`/chat/${newSession.id}`)
}
