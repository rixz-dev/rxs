import { createAdminClient } from '@/lib/supabase/admin'
import type { LogSeverity } from '@/types'

export async function writeLog(entry: {
  userId?:        string
  ipAddress:      string
  severity:       LogSeverity
  eventType:      string
  anomalyScore?:  number
  meta?:          Record<string, unknown>
}) {
  try {
    const admin = createAdminClient()
    await admin.from('admin_logs').insert({
      user_id:       entry.userId ?? null,
      ip_address:    entry.ipAddress,
      severity:      entry.severity,
      event_type:    entry.eventType,
      anomaly_score: entry.anomalyScore ?? 0,
      meta:          entry.meta ?? {},
    })
  } catch (err) {
    console.error('[writeLog]', err)
  }
}
