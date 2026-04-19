// lib/auth/roles.ts
import { Redis }      from '@upstash/redis'
import type { UserRole } from '@/types'

const redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! })

export const ROLE_LIMITS = {
  free:  { chatLimit: 10, windowMinutes: 120, toolSessions: 7  },
  pro:   { chatLimit: 20, windowMinutes: 120, toolSessions: 15 },
  max:   { chatLimit: 40, windowMinutes: 180, toolSessions: -1 },
  admin: { chatLimit: -1, windowMinutes: 0,   toolSessions: -1 },
} as const

export interface RateLimitResult { allowed: boolean; remaining: number; resetIn: number; reason?: string }

export async function checkChatRateLimit(userId: string, role: UserRole): Promise<RateLimitResult> {
  const limits = ROLE_LIMITS[role]
  if (limits.chatLimit === -1) return { allowed: true, remaining: -1, resetIn: 0 }
  const windowSecs = limits.windowMinutes * 60
  const key = `rate:chat:${userId}`
  const current = await redis.get<number>(key)
  if (!current) { await redis.setex(key, windowSecs, 1); return { allowed: true, remaining: limits.chatLimit - 1, resetIn: windowSecs } }
  if (current >= limits.chatLimit) { const ttl = await redis.ttl(key); return { allowed: false, remaining: 0, resetIn: ttl, reason: `Limit ${limits.chatLimit}x per ${limits.windowMinutes} menit.` } }
  await redis.incr(key)
  return { allowed: true, remaining: limits.chatLimit - (current + 1), resetIn: await redis.ttl(key) }
}

export async function checkToolSessionLimit(userId: string, role: UserRole): Promise<RateLimitResult> {
  const limits = ROLE_LIMITS[role]
  if (limits.toolSessions === -1) return { allowed: true, remaining: -1, resetIn: 0 }
  const key = `tool:sessions:${userId}`
  const current = await redis.get<number>(key)
  if (!current) { await redis.setex(key, 86400, 1); return { allowed: true, remaining: limits.toolSessions - 1, resetIn: 86400 } }
  if (current >= limits.toolSessions) return { allowed: false, remaining: 0, resetIn: await redis.ttl(key), reason: `Tool session limit ${limits.toolSessions}x per hari.` }
  await redis.incr(key)
  return { allowed: true, remaining: limits.toolSessions - (current + 1), resetIn: await redis.ttl(key) }
}

export async function isIpBanned(ip: string): Promise<boolean> { return (await redis.get(`ban:ip:${ip}`)) === '1' }
export async function banIpRedis(ip: string, ttlSeconds?: number) {
  const key = `ban:ip:${ip}`
  ttlSeconds ? await redis.setex(key, ttlSeconds, '1') : await redis.set(key, '1')
}
