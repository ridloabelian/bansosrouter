-- FlareRoute Initial D1 Schema Migration (0000_initial_schema.sql)

CREATE TABLE IF NOT EXISTS provider_connections (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  auth_type TEXT NOT NULL DEFAULT 'api_key',
  encrypted_credentials TEXT NOT NULL,
  account_label TEXT NOT NULL DEFAULT 'default',
  base_url TEXT,
  priority INTEGER NOT NULL DEFAULT 100,
  weight INTEGER NOT NULL DEFAULT 100,
  tier TEXT NOT NULL DEFAULT 'free',
  tos_risk TEXT NOT NULL DEFAULT 'safe',
  daily_token_limit INTEGER NOT NULL DEFAULT 1000000,
  tokens_used_today INTEGER NOT NULL DEFAULT 0,
  window_token_limit INTEGER NOT NULL DEFAULT 250000,
  tokens_used_window INTEGER NOT NULL DEFAULT 0,
  window_reset_at INTEGER,
  token_expires_at INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms REAL NOT NULL DEFAULT 350,
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost_usd REAL NOT NULL DEFAULT 0,
  supported_models_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  last_used_at INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_provider_connections_provider ON provider_connections (provider);
CREATE INDEX IF NOT EXISTS idx_provider_connections_status ON provider_connections (status);

CREATE TABLE IF NOT EXISTS combos (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  strategy TEXT NOT NULL DEFAULT 'p2c',
  candidates_json TEXT NOT NULL DEFAULT '[]',
  judge_model TEXT,
  judge_connection_id TEXT,
  max_context_threshold INTEGER NOT NULL DEFAULT 128000,
  relay_target_model TEXT,
  compression_profile TEXT NOT NULL DEFAULT 'balanced',
  custom_compression_layers_json TEXT NOT NULL DEFAULT '[]',
  sanitize_output INTEGER NOT NULL DEFAULT 1,
  cache_ttl_seconds INTEGER NOT NULL DEFAULT 0,
  is_system INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_combos_slug ON combos (slug);

CREATE TABLE IF NOT EXISTS model_aliases (
  id TEXT PRIMARY KEY NOT NULL,
  source_model TEXT NOT NULL,
  target_model TEXT NOT NULL,
  target_provider TEXT,
  description TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_model_aliases_source ON model_aliases (source_model);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  daily_budget_usd REAL NOT NULL DEFAULT 10.0,
  monthly_budget_usd REAL NOT NULL DEFAULT 100.0,
  spent_today_usd REAL NOT NULL DEFAULT 0.0,
  spent_month_usd REAL NOT NULL DEFAULT 0.0,
  quota_share_percent INTEGER NOT NULL DEFAULT 100,
  rate_limit_rpm INTEGER NOT NULL DEFAULT 120,
  allowed_models_json TEXT NOT NULL DEFAULT '["*"]',
  default_strategy TEXT NOT NULL DEFAULT 'auto',
  compression_profile TEXT NOT NULL DEFAULT 'balanced',
  compression_layers_json TEXT NOT NULL DEFAULT '["session-dedup","ccr","lite","rtk","responses-tool","headroom"]',
  pii_guard_enabled INTEGER NOT NULL DEFAULT 1,
  total_requests INTEGER NOT NULL DEFAULT 0,
  total_tokens_saved INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_api_keys_hash ON api_keys (key_hash);

CREATE TABLE IF NOT EXISTS usage_logs (
  id TEXT PRIMARY KEY NOT NULL,
  request_id TEXT NOT NULL,
  api_key_id TEXT,
  connection_id TEXT,
  provider TEXT NOT NULL,
  model_requested TEXT NOT NULL,
  model_used TEXT NOT NULL,
  strategy_used TEXT NOT NULL,
  inbound_protocol TEXT NOT NULL,
  upstream_protocol TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  cached_tokens INTEGER NOT NULL DEFAULT 0,
  tokens_saved INTEGER NOT NULL DEFAULT 0,
  compression_layers_json TEXT NOT NULL DEFAULT '[]',
  cost_usd REAL NOT NULL DEFAULT 0.0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  status_code INTEGER NOT NULL DEFAULT 200,
  is_stream INTEGER NOT NULL DEFAULT 0,
  cache_hit INTEGER NOT NULL DEFAULT 0,
  redacted_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_created_at ON usage_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_provider ON usage_logs (provider);
CREATE INDEX IF NOT EXISTS idx_usage_logs_api_key ON usage_logs (api_key_id);

CREATE TABLE IF NOT EXISTS domain_budgets (
  id TEXT PRIMARY KEY NOT NULL,
  domain TEXT NOT NULL,
  daily_limit_usd REAL NOT NULL DEFAULT 50.0,
  monthly_limit_usd REAL NOT NULL DEFAULT 500.0,
  spent_today_usd REAL NOT NULL DEFAULT 0.0,
  spent_month_usd REAL NOT NULL DEFAULT 0.0,
  alert_threshold_percent INTEGER NOT NULL DEFAULT 80,
  hard_cap_enabled INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_domain_budgets_domain ON domain_budgets (domain);

CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'discord',
  target_url TEXT NOT NULL,
  secret_header TEXT,
  events_json TEXT NOT NULL DEFAULT '["circuit_open","budget_exceeded","oauth_refresh_failed","model_lockout"]',
  is_active INTEGER NOT NULL DEFAULT 1,
  last_triggered_at INTEGER,
  last_status INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY NOT NULL,
  value_json TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);
