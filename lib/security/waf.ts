// lib/security/waf.ts
// WAF detection logic — dipanggil dari middleware + API routes

export interface WafResult {
  blocked:      boolean
  shadow:       boolean    // shadow mode: log tapi jangan block
  anomalyScore: number
  eventType?:   string
  reason?:      string
}

// ─── UA signatures ────────────────────────────────────────────────
const UA_SIGNATURES = [
  { pattern: /sqlmap/i,          type: 'sqlmap_scan',    score: 90 },
  { pattern: /nmap/i,            type: 'nmap_scan',      score: 85 },
  { pattern: /whatweb/i,         type: 'whatweb_probe',  score: 70 },
  { pattern: /nikto/i,           type: 'nikto_scan',     score: 90 },
  { pattern: /masscan/i,         type: 'masscan_scan',   score: 95 },
  { pattern: /dirbuster/i,       type: 'dir_scan',       score: 90 },
  { pattern: /hydra/i,           type: 'bruteforce',     score: 95 },
  { pattern: /python-requests/i, type: 'script_probe',   score: 50 },
  { pattern: /go-http-client/i,  type: 'script_probe',   score: 45 },
  { pattern: /zgrab/i,           type: 'zgrab_scan',     score: 80 },
  { pattern: /curl\//i,          type: 'curl_probe',     score: 40 },
] as const

// ─── Path traversal / SQLi / XSS in URL path + query ─────────────
const PATH_SIGNATURES = [
  { pattern: /(\.\.[\/\\]){2,}/,              type: 'path_traversal', score: 80 },
  { pattern: /union\s+select/i,               type: 'sqli',           score: 85 },
  { pattern: /'\s*(or|and)\s+['"]?\d/i,       type: 'sqli',           score: 75 },
  { pattern: /<script[\s>]/i,                  type: 'xss',            score: 70 },
  { pattern: /javascript:/i,                   type: 'xss',            score: 65 },
  { pattern: /\bexec\s*\(/i,                   type: 'rce_attempt',    score: 80 },
  { pattern: /\/etc\/passwd/i,                 type: 'lfi',            score: 85 },
  { pattern: /\/proc\/self/i,                  type: 'lfi',            score: 85 },
  { pattern: /\bwget\b|\bcurl\b.*http/i,       type: 'ssrf_attempt',   score: 60 },
] as const

const BLOCK_THRESHOLD  = 70
const SHADOW_THRESHOLD = 40

export function runWaf(ua: string, path: string, headers?: Record<string, string>): WafResult {
  let score = 0
  let detectedType: string | undefined

  // UA check
  for (const sig of UA_SIGNATURES) {
    if (sig.pattern.test(ua)) {
      if (sig.score > score) { score = sig.score; detectedType = sig.type }
    }
  }

  // Path + query check
  for (const sig of PATH_SIGNATURES) {
    if (sig.pattern.test(path)) {
      if (sig.score > score) { score = sig.score; detectedType = sig.type }
    }
  }

  // Tor exit node header
  if (headers?.['x-tor-exit-node']) {
    if (75 > score) { score = 75; detectedType = 'tor_exit' }
  }

  return {
    blocked:      score >= BLOCK_THRESHOLD,
    shadow:       score >= SHADOW_THRESHOLD && score < BLOCK_THRESHOLD,
    anomalyScore: score,
    eventType:    detectedType,
    reason:       detectedType
      ? `WAF: ${detectedType} detected (score ${score})`
      : undefined,
  }
}
