// types/index.ts
export type UserRole      = 'free' | 'pro' | 'max' | 'admin'
export type BanStatus     = 'active' | 'banned' | 'shadow'
export type FileType      = 'txt'|'zip'|'sh'|'pdf'|'py'|'js'|'css'|'html'|'php'|'env'|'jpg'|'png'|'ts'|'json'|'md'
export type ApiKeyStatus  = 'active' | 'revoked' | 'expired' | 'suspicious'
export type SessionStatus = 'active' | 'archived' | 'deleted'
export type LogSeverity   = 'info' | 'warning' | 'critical'
export type MessageRole   = 'user' | 'aria' | 'nexus' | 'system'
export type UpgradeStatus = 'pending' | 'used' | 'expired'

export interface User {
  id:                string
  username:          string
  email?:            string
  supabase_uid?:     string
  role:              UserRole
  status:            BanStatus
  last_ip?:          string
  registered_ip?:    string
  chat_count_today:  number
  chat_window_start: string
  created_at:        string
  updated_at:        string
  last_seen_at:      string
}

export interface Session {
  id:              string
  user_id:         string
  title:           string
  status:          SessionStatus
  dna_tags:        string[]
  token_count:     number
  context_limit:   number
  created_at:      string
  updated_at:      string
  last_message_at: string
}

export interface Message {
  id:            string
  session_id:    string
  user_id:       string
  role:          MessageRole
  content:       string
  thinking_raw?: string
  thinking_open: boolean
  iteration:     number
  token_usage:   { prompt?: number; completion?: number; total?: number }
  created_at:    string
}

export interface FileRecord {
  id:           string
  user_id:      string
  session_id?:  string
  filename:     string
  file_type:    FileType
  size_bytes:   number
  storage_url:  string
  is_encrypted: boolean
  source:       'ai_generated' | 'user_upload'
  created_at:   string
}

export interface ApiKey {
  id:              string
  user_id:         string
  key_hash:        string
  key_prefix:      string
  status:          ApiKeyStatus
  created_from_ip?: string
  last_used_at?:   string
  total_requests:  number
  total_tokens:    number
  anomaly_score:   number
  expires_at?:     string
  created_at:      string
}

export interface AdminLog {
  id:              string
  user_id?:        string
  ip_address:      string
  user_agent?:     string
  request_path?:   string
  request_method?: string
  severity:        LogSeverity
  event_type:      string
  anomaly_score:   number
  meta:            Record<string, unknown>
  action_taken?:   string
  created_at:      string
}

export interface AgentMessage {
  role:    'user' | 'assistant'
  content: string
}

export interface AriaStreamChunk {
  type:       'aria_token'|'nexus_thinking'|'nexus_token'|'iteration_start'|'iteration_end'|'done'|'error'
  content?:   string
  iteration?: number
  error?:     string
}

export interface AgentLoopState {
  iteration:     number
  maxIterations: number
  ariaOutput:    string
  nexusOutput:   string
  nexusThinking: string
  isComplete:    boolean
}

export interface RoleLimit {
  role:          UserRole
  chatLimit:     number
  windowMinutes: number
  toolSessions:  number
}

export const ROLE_LIMITS: Record<UserRole, RoleLimit> = {
  free:  { role: 'free',  chatLimit: 10, windowMinutes: 120, toolSessions: 7   },
  pro:   { role: 'pro',   chatLimit: 20, windowMinutes: 120, toolSessions: 15  },
  max:   { role: 'max',   chatLimit: 40, windowMinutes: 180, toolSessions: -1  },
  admin: { role: 'admin', chatLimit: -1, windowMinutes: 0,   toolSessions: -1  },
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?:   T
  error?:  string
  code?:   string
}

export const WAF_SIGNATURES = [
  { pattern: /sqlmap/i,          type: 'sqlmap_scan',   score: 90 },
  { pattern: /nmap/i,            type: 'nmap_scan',     score: 85 },
  { pattern: /nikto/i,           type: 'nikto_scan',    score: 90 },
  { pattern: /masscan/i,         type: 'masscan_scan',  score: 95 },
  { pattern: /dirbuster/i,       type: 'dir_scan',      score: 90 },
  { pattern: /hydra/i,           type: 'bruteforce',    score: 95 },
  { pattern: /python-requests/i, type: 'script_probe',  score: 50 },
  { pattern: /curl\//i,          type: 'curl_probe',    score: 40 },
] as const

export const WAF_BLOCK_THRESHOLD  = 70
export const WAF_SHADOW_THRESHOLD = 40
