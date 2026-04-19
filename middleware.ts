import { NextRequest, NextResponse } from 'next/server'
import { createServerClient }        from '@supabase/ssr'

const WAF_SIGS = [
  { p: /sqlmap/i,          t: 'sqlmap_scan',   s: 90 },
  { p: /nmap/i,            t: 'nmap_scan',     s: 85 },
  { p: /nikto/i,           t: 'nikto_scan',    s: 90 },
  { p: /masscan/i,         t: 'masscan_scan',  s: 95 },
  { p: /dirbuster/i,       t: 'dir_scan',      s: 90 },
  { p: /hydra/i,           t: 'bruteforce',    s: 95 },
  { p: /python-requests/i, t: 'script_probe',  s: 50 },
  { p: /go-http-client/i,  t: 'script_probe',  s: 45 },
  { p: /zgrab/i,           t: 'zgrab_scan',    s: 80 },
  { p: /curl\//i,          t: 'curl_probe',    s: 40 },
] as const

const PATH_SIGS = [
  { p: /(\.\.[\/\\]){2,}/,        t: 'path_traversal', s: 80 },
  { p: /union\s+select/i,         t: 'sqli',           s: 85 },
  { p: /<script[\s>]/i,           t: 'xss',            s: 70 },
  { p: /\/etc\/passwd/i,          t: 'lfi',            s: 90 },
] as const

const BLOCK  = 70
const SHADOW = 40

function waf(ua: string, path: string, tor: boolean) {
  let score = 0; let type: string | undefined
  for (const sig of WAF_SIGS)  if (sig.p.test(ua))   { if (sig.s > score) { score = sig.s; type = sig.t } }
  for (const sig of PATH_SIGS) if (sig.p.test(path)) { if (sig.s > score) { score = sig.s; type = sig.t } }
  if (tor && 75 > score) { score = 75; type = 'tor_exit' }
  return { blocked: score >= BLOCK, shadow: score >= SHADOW && score < BLOCK, score, type }
}

const PROTECTED = ['/chat', '/history', '/settings', '/docs']
const ADMIN_R   = ['/admin/dashboard']
const AUTH_R    = ['/login', '/register']

async function verifyAdminCookie(req: NextRequest): Promise<boolean> {
  try {
    const token = req.cookies.get('admin_session')?.value
    if (!token) return false
    const url   = process.env.UPSTASH_REDIS_REST_URL
    const tkn   = process.env.UPSTASH_REDIS_REST_TOKEN
    if (!url || !tkn) return false
    const r = await fetch(`${url}/get/admin:session:${token}`, {
      headers: { Authorization: `Bearer ${tkn}` },
    })
    const j = await r.json()
    return !!j.result
  } catch { return false }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const ip  = (req.headers.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim()
  const ua  = req.headers.get('user-agent') ?? ''
  const tor = !!req.headers.get('x-tor-exit-node')

  const w = waf(ua, pathname, tor)
  if (w.blocked) {
    return new NextResponse(JSON.stringify({ error: 'Access denied.' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
  }

  let response = NextResponse.next({ request: { headers: req.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get:    (n: string) => req.cookies.get(n)?.value,
        set:    (n: string, v: string, o: Record<string, unknown>) => { req.cookies.set({ name: n, value: v, ...o }); response = NextResponse.next({ request: { headers: req.headers } }); response.cookies.set({ name: n, value: v, ...o }) },
        remove: (n: string, o: Record<string, unknown>) => { req.cookies.set({ name: n, value: '', ...o }); response = NextResponse.next({ request: { headers: req.headers } }); response.cookies.set({ name: n, value: '', ...o }) },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (PROTECTED.some(r => pathname.startsWith(r)) && !user) {
    const url = new URL('/login', req.url); url.searchParams.set('redirect', pathname); return NextResponse.redirect(url)
  }
  if (AUTH_R.some(r => pathname.startsWith(r)) && user) return NextResponse.redirect(new URL('/chat', req.url))
  if (ADMIN_R.some(r => pathname.startsWith(r))) {
    const validAdmin = await verifyAdminCookie(req)
    if (!validAdmin) return NextResponse.redirect(new URL('/admin', req.url))
  }

  response.headers.set('x-client-ip',     ip)
  response.headers.set('x-anomaly-score',  String(w.score))
  if (w.type) response.headers.set('x-waf-event', w.type)

  return response
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'] }
