import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * 1. PROVIDER CONNECTIONS
 * Stores API Keys, OAuth Accounts (Claude Code, Codex, Gemini CLI, Copilot, Qwen, Kiro, Antigravity),
 * Free-Tier providers (Groq, Cerebras, OpenRouter, NVIDIA NIM, Workers AI), and Vertex Service Accounts.
 * Sensitive tokens/keys are stored encrypted at rest via WebCrypto AES-256-GCM in `encryptedCredentials`.
 */
export const providerConnections = sqliteTable(
  'provider_connections',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    provider: text('provider').notNull(), // e.g. 'anthropic', 'openai', 'gemini', 'claude-code', 'codex', 'github-copilot', 'groq', 'cerebras', 'workers-ai'
    authType: text('auth_type').notNull().default('api_key'), // 'api_key' | 'oauth_pkce' | 'oauth_device' | 'service_account' | 'workers_ai'
    encryptedCredentials: text('encrypted_credentials').notNull(), // AES-256-GCM ciphertext JSON: { apiKey?, accessToken?, refreshToken?, clientId?, serviceAccountJson?, extraHeaders? }
    accountLabel: text('account_label').notNull().default('default'), // Email or account identifier
    baseUrl: text('base_url'), // Optional custom endpoint override
    priority: integer('priority').notNull().default(100), // Lower number = higher priority
    weight: integer('weight').notNull().default(100), // Weight for weighted routing
    tier: text('tier').notNull().default('free'), // 'free' | 'subscription' | 'payg' | 'enterprise'
    tosRisk: text('tos_risk').notNull().default('safe'), // 'safe' | 'caution' | 'tos_avoid'
    // Quota & Reset-Window tracking (for fill-first, reset-aware, headroom, thrifty strategies)
    dailyTokenLimit: integer('daily_token_limit').notNull().default(1000000),
    tokensUsedToday: integer('tokens_used_today').notNull().default(0),
    windowTokenLimit: integer('window_token_limit').notNull().default(250000), // e.g., 5-hour subscription window
    tokensUsedWindow: integer('tokens_used_window').notNull().default(0),
    windowResetAt: integer('window_reset_at'), // Unix epoch ms for next 5h/daily quota reset
    tokenExpiresAt: integer('token_expires_at'), // Unix epoch ms when OAuth access_token expires
    // Health & Telemetry
    status: text('status').notNull().default('active'), // 'active' | 'cooldown' | 'circuit_open' | 'disabled' | 'reauth_required'
    consecutiveFailures: integer('consecutive_failures').notNull().default(0),
    avgLatencyMs: real('avg_latency_ms').notNull().default(350),
    totalRequests: integer('total_requests').notNull().default(0),
    totalTokens: integer('total_tokens').notNull().default(0),
    totalCostUsd: real('total_cost_usd').notNull().default(0),
    supportedModelsJson: text('supported_models_json').notNull().default('[]'), // JSON string[]
    metadataJson: text('metadata_json').notNull().default('{}'), // JSON Record<string, unknown>
    lastUsedAt: integer('last_used_at'),
    lastError: text('last_error'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_provider_connections_provider').on(table.provider),
    index('idx_provider_connections_status').on(table.status),
  ]
);

/**
 * 2. COMBOS (Virtual Models & 19-Strategy Pipelines)
 * Defines multi-provider fallback chains, fusion ensembles, or multi-stage pipelines.
 */
export const combos = sqliteTable(
  'combos',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(), // e.g. 'auto/coding', 'auto/fast', 'team-sonnet-cluster'
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    strategy: text('strategy').notNull().default('p2c'), // One of the 19 routing strategies
    candidatesJson: text('candidates_json').notNull().default('[]'), // JSON array of ComboCandidate
    judgeModel: text('judge_model'), // Used when strategy === 'fusion'
    judgeConnectionId: text('judge_connection_id'),
    maxContextThreshold: integer('max_context_threshold').notNull().default(128000), // Used for 'context-relay'
    relayTargetModel: text('relay_target_model'), // Long-context target model (e.g., gemini-2.5-pro)
    compressionProfile: text('compression_profile').notNull().default('balanced'), // 'off' | 'lite' | 'balanced' | 'aggressive' | 'ultra' | 'custom'
    customCompressionLayersJson: text('custom_compression_layers_json').notNull().default('[]'),
    sanitizeOutput: integer('sanitize_output', { mode: 'boolean' }).notNull().default(true),
    cacheTtlSeconds: integer('cache_ttl_seconds').notNull().default(0),
    isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [uniqueIndex('uidx_combos_slug').on(table.slug)]
);

/**
 * 3. MODEL ALIASES
 * Remaps incoming model names (e.g. 'gpt-4o' -> 'auto/fast' or 'claude-3-5-sonnet-20241022' -> 'claude-sonnet-4-6').
 */
export const modelAliases = sqliteTable(
  'model_aliases',
  {
    id: text('id').primaryKey(),
    sourceModel: text('source_model').notNull(),
    targetModel: text('target_model').notNull(),
    targetProvider: text('target_provider'), // null = resolve via router/combo
    description: text('description').notNull().default(''),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [uniqueIndex('uidx_model_aliases_source').on(table.sourceModel)]
);

/**
 * 4. API KEYS (Client Gateway Keys with USD Budgets & Quota-Share)
 * Clients authenticate using `Authorization: Bearer fr_live_...` or `x-api-key: fr_live_...`.
 */
export const apiKeys = sqliteTable(
  'api_keys',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    keyPrefix: text('key_prefix').notNull(), // e.g. 'fr_live_9a8b...'
    keyHash: text('key_hash').notNull(), // SHA-256 hex digest of full key
    dailyBudgetUsd: real('daily_budget_usd').notNull().default(10.0),
    monthlyBudgetUsd: real('monthly_budget_usd').notNull().default(100.0),
    spentTodayUsd: real('spent_today_usd').notNull().default(0.0),
    spentMonthUsd: real('spent_month_usd').notNull().default(0.0),
    quotaSharePercent: integer('quota_share_percent').notNull().default(100), // Max % of free/subscription pool this key can consume
    rateLimitRpm: integer('rate_limit_rpm').notNull().default(120),
    allowedModelsJson: text('allowed_models_json').notNull().default('["*"]'), // JSON string[]
    defaultStrategy: text('default_strategy').notNull().default('auto'),
    compressionProfile: text('compression_profile').notNull().default('balanced'),
    compressionLayersJson: text('compression_layers_json').notNull().default('["session-dedup","ccr","lite","rtk","responses-tool","headroom"]'),
    piiGuardEnabled: integer('pii_guard_enabled', { mode: 'boolean' }).notNull().default(true),
    totalRequests: integer('total_requests').notNull().default(0),
    totalTokensSaved: integer('total_tokens_saved').notNull().default(0),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    expiresAt: integer('expires_at'),
    lastUsedAt: integer('last_used_at'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [uniqueIndex('uidx_api_keys_hash').on(table.keyHash)]
);

/**
 * 5. USAGE LOGS
 * Non-blocking request & token savings history persisted via `executionCtx.waitUntil()`.
 */
export const usageLogs = sqliteTable(
  'usage_logs',
  {
    id: text('id').primaryKey(),
    requestId: text('request_id').notNull(),
    apiKeyId: text('api_key_id'),
    connectionId: text('connection_id'),
    provider: text('provider').notNull(),
    modelRequested: text('model_requested').notNull(),
    modelUsed: text('model_used').notNull(),
    strategyUsed: text('strategy_used').notNull(),
    inboundProtocol: text('inbound_protocol').notNull(), // 'openai-chat' | 'openai-responses' | 'anthropic-messages' | 'gemini' | 'multimodal'
    upstreamProtocol: text('upstream_protocol').notNull(),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    cachedTokens: integer('cached_tokens').notNull().default(0),
    tokensSaved: integer('tokens_saved').notNull().default(0),
    compressionLayersJson: text('compression_layers_json').notNull().default('[]'),
    costUsd: real('cost_usd').notNull().default(0.0),
    latencyMs: integer('latency_ms').notNull().default(0),
    statusCode: integer('status_code').notNull().default(200),
    isStream: integer('is_stream', { mode: 'boolean' }).notNull().default(false),
    cacheHit: integer('cache_hit', { mode: 'boolean' }).notNull().default(false),
    redactedCount: integer('redacted_count').notNull().default(0),
    errorMessage: text('error_message'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_usage_logs_created_at').on(table.createdAt),
    index('idx_usage_logs_provider').on(table.provider),
    index('idx_usage_logs_api_key').on(table.apiKeyId),
  ]
);

/**
 * 6. DOMAIN BUDGETS
 * Global or per-provider / per-department USD spend guardrails.
 */
export const domainBudgets = sqliteTable(
  'domain_budgets',
  {
    id: text('id').primaryKey(),
    domain: text('domain').notNull(), // e.g. 'global', 'provider:anthropic', 'provider:openai', 'team:engineering'
    dailyLimitUsd: real('daily_limit_usd').notNull().default(50.0),
    monthlyLimitUsd: real('monthly_limit_usd').notNull().default(500.0),
    spentTodayUsd: real('spent_today_usd').notNull().default(0.0),
    spentMonthUsd: real('spent_month_usd').notNull().default(0.0),
    alertThresholdPercent: integer('alert_threshold_percent').notNull().default(80),
    hardCapEnabled: integer('hard_cap_enabled', { mode: 'boolean' }).notNull().default(true),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [uniqueIndex('uidx_domain_budgets_domain').on(table.domain)]
);

/**
 * 7. WEBHOOKS
 * Outbound notifications (Discord, Slack, Telegram, Generic HTTP) dispatched via `waitUntil()`.
 */
export const webhooks = sqliteTable('webhooks', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull().default('discord'), // 'discord' | 'slack' | 'telegram' | 'generic'
  targetUrl: text('target_url').notNull(),
  secretHeader: text('secret_header'),
  eventsJson: text('events_json').notNull().default('["circuit_open","budget_exceeded","oauth_refresh_failed","model_lockout"]'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  lastTriggeredAt: integer('last_triggered_at'),
  lastStatus: integer('last_status'),
  createdAt: integer('created_at').notNull(),
});

/**
 * 8. SETTINGS
 * Global gateway key-value configuration store.
 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  valueJson: text('value_json').notNull(),
  description: text('description').notNull().default(''),
  updatedAt: integer('updated_at').notNull(),
});

export type ProviderConnectionRow = typeof providerConnections.$inferSelect;
export type NewProviderConnectionRow = typeof providerConnections.$inferInsert;
export type ComboRow = typeof combos.$inferSelect;
export type NewComboRow = typeof combos.$inferInsert;
export type ModelAliasRow = typeof modelAliases.$inferSelect;
export type ApiKeyRow = typeof apiKeys.$inferSelect;
export type UsageLogRow = typeof usageLogs.$inferSelect;
export type DomainBudgetRow = typeof domainBudgets.$inferSelect;
export type WebhookRow = typeof webhooks.$inferSelect;
export type SettingRow = typeof settings.$inferSelect;
