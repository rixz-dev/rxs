-- ANERS Aria c11 — Full Supabase Schema
-- Jalankan di Supabase SQL Editor, sekali jalan

-- ─── Users ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username          TEXT NOT NULL UNIQUE,
  email             TEXT,
  supabase_uid      UUID UNIQUE,
  role              TEXT NOT NULL DEFAULT 'free' CHECK (role IN ('free','pro','max','admin')),
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','banned','shadow')),
  last_ip           TEXT,
  registered_ip     TEXT,
  chat_count_today  INTEGER DEFAULT 0,
  chat_window_start TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Sessions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL DEFAULT 'New Chat',
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','deleted')),
  dna_tags         TEXT[] DEFAULT '{}',
  checkpoints      JSONB DEFAULT '[]',
  token_count      INTEGER DEFAULT 0,
  context_limit    INTEGER DEFAULT 128000,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  last_message_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Messages ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id    UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('user','aria','nexus','system')),
  content       TEXT NOT NULL DEFAULT '',
  thinking_raw  TEXT,
  thinking_open BOOLEAN DEFAULT FALSE,
  iteration     INTEGER DEFAULT 0,
  agent_pair_id UUID,
  token_usage   JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Files ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS files (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id    UUID REFERENCES sessions(id) ON DELETE SET NULL,
  filename      TEXT NOT NULL,
  file_type     TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL DEFAULT 0,
  storage_url   TEXT NOT NULL,
  is_encrypted  BOOLEAN DEFAULT FALSE,
  source        TEXT NOT NULL DEFAULT 'user_upload' CHECK (source IN ('ai_generated','user_upload')),
  sandbox_id    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── API Keys ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash         TEXT NOT NULL UNIQUE,
  key_prefix       TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired','suspicious')),
  created_from_ip  TEXT,
  last_used_ip     TEXT,
  last_used_at     TIMESTAMPTZ,
  total_requests   INTEGER DEFAULT 0,
  total_tokens     INTEGER DEFAULT 0,
  endpoints_hit    TEXT[] DEFAULT '{}',
  anomaly_score    INTEGER DEFAULT 0,
  expires_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Admin Logs ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_address      TEXT NOT NULL,
  user_agent      TEXT,
  request_path    TEXT,
  request_method  TEXT,
  severity        TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  event_type      TEXT NOT NULL,
  anomaly_score   INTEGER DEFAULT 0,
  meta            JSONB DEFAULT '{}',
  action_taken    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_username    ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_supabase    ON users(supabase_uid);
CREATE INDEX IF NOT EXISTS idx_sessions_user     ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status   ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_messages_session  ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_user     ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_files_user        ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user     ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash     ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_admin_logs_ip     ON admin_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_admin_logs_sev    ON admin_logs(severity);
CREATE INDEX IF NOT EXISTS idx_admin_logs_time   ON admin_logs(created_at DESC);

-- ─── RLS ─────────────────────────────────────────────────────────
-- Service role (admin client) bypass RLS — semua server route pakai createAdminClient()
ALTER TABLE users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE files       ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys    ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs  ENABLE ROW LEVEL SECURITY;
