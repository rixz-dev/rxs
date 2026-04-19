// lib/security/telegram.ts
// Telegram OTP untuk admin 2FA
// OTP: 6 digit, expire 5 menit, one-time use via Redis

import { Redis } from '@upstash/redis'

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const TELEGRAM_BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN!
const TELEGRAM_ADMIN_CHAT = process.env.TELEGRAM_ADMIN_CHAT_ID!   // '8294322624'
const OTP_TTL_SECONDS     = 300   // 5 menit
const OTP_KEY             = 'admin:otp'

// ─── Generate + kirim OTP ke Telegram admin ──────────────────────
export async function sendAdminOtp(): Promise<{ ok: boolean; error?: string }> {
  const otp = String(Math.floor(100000 + Math.random() * 900000))

  // Simpan di Redis
  await redis.setex(OTP_KEY, OTP_TTL_SECONDS, otp)

  // Kirim via Telegram Bot API
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id:    TELEGRAM_ADMIN_CHAT,
        parse_mode: 'HTML',
        text: `🔐 <b>ANERS Admin Login</b>\n\nVerification code:\n<code>${otp}</code>\n\n⏱ Expires in 5 minutes.\nJika bukan kamu yang login, abaikan pesan ini.`,
      }),
    })

    const data = await res.json()
    if (!data.ok) {
      return { ok: false, error: `Telegram error: ${data.description}` }
    }
    return { ok: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Network error: ${msg}` }
  }
}

// ─── Verify OTP — one-time use ────────────────────────────────────
// BUG FIX: Upstash Redis kadang return numeric string sebagai number
// sehingga strict equality (===) gagal karena 123456 !== "123456"
// Fix: coerce keduanya ke String sebelum compare
export async function verifyAdminOtp(inputOtp: string): Promise<boolean> {
  const stored = await redis.get(OTP_KEY)
  if (stored === null || stored === undefined) return false

  const valid = String(stored).trim() === String(inputOtp).trim()
  if (valid) {
    // Invalidate immediately after use (one-time)
    await redis.del(OTP_KEY)
  }
  return valid
}

// ─── Send arbitrary Telegram notification (for admin alerts) ─────
export async function sendTelegramAlert(message: string): Promise<void> {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`
  try {
    await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id:    TELEGRAM_ADMIN_CHAT,
        parse_mode: 'HTML',
        text:       message,
      }),
    })
  } catch {}
}
