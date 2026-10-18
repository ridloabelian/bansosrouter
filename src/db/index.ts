import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';
import type { D1Database } from '../types/env';

export type AppDatabase = DrizzleD1Database<typeof schema>;

let schemaInitialized = false;

export function getDb(d1: D1Database): AppDatabase {
  return drizzle(d1, { schema });
}

/**
 * Idempotent bootstrap of D1 tables + system `auto/*` combos + default settings
 * so FlareRoute works out-of-the-box on first request or `wrangler dev`.
 */
export async function ensureDatabaseInitialized(d1: D1Database): Promise<void> {
  if (schemaInitialized) return;
  try {
    const ddlStatements = [
      `CREATE TABLE IF NOT EXISTS provider_connections (
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
      )`,
      `CREATE TABLE IF NOT EXISTS combos (
        id TEXT PRIMARY KEY NOT NULL,
        slug TEXT NOT NULL UNIQUE,
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
      )`,
      `CREATE TABLE IF NOT EXISTS model_aliases (
        id TEXT PRIMARY KEY NOT NULL,
        source_model TEXT NOT NULL UNIQUE,
        target_model TEXT NOT NULL,
        target_provider TEXT,
        description TEXT NOT NULL DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
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
      )`,
      `CREATE TABLE IF NOT EXISTS usage_logs (
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
      )`,
      `CREATE TABLE IF NOT EXISTS domain_budgets (
        id TEXT PRIMARY KEY NOT NULL,
        domain TEXT NOT NULL UNIQUE,
        daily_limit_usd REAL NOT NULL DEFAULT 50.0,
        monthly_limit_usd REAL NOT NULL DEFAULT 500.0,
        spent_today_usd REAL NOT NULL DEFAULT 0.0,
        spent_month_usd REAL NOT NULL DEFAULT 0.0,
        alert_threshold_percent INTEGER NOT NULL DEFAULT 80,
        hard_cap_enabled INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS webhooks (
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
      )`,
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value_json TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        updated_at INTEGER NOT NULL
      )`,
    ];

    await d1.batch(ddlStatements.map((sql) => d1.prepare(sql)));

    const now = Date.now();
    const systemCombos = [
      {
        id: 'sys-bansos-auto',
        slug: 'bansos/auto',
        name: 'Bansos Auto (100% Rp 0 / $0 Maximizer)',
        description: 'Rotasi pintar lintas semua provider gratisan berdasarkan sisa kuota RPD/TPD & kesehatan.',
        strategy: 'thrifty',
      },
      {
        id: 'sys-bansos-nocc',
        slug: 'bansos/no-cc',
        name: 'Bansos Tanpa Kartu Kredit (Strict No-CC Pool)',
        description: 'Hanya merutekan ke provider yang 100% bebas kartu kredit & bebas verifikasi telepon (Groq, Gemini, Cerebras, OpenRouter, Z.AI, Workers AI, Pollinations).',
        strategy: 'cost-optimized',
      },
      {
        id: 'sys-bansos-coding',
        slug: 'bansos/coding',
        name: 'Bansos Coding Agent (Claude Code / Codex / Cline)',
        description: 'Prioritaskan model coding gratis terbaik (Codestral 256K, Qwen 2.5 Coder 32B, DeepSeek V4 Pro, Big Pickle, Gemini 2.5 Pro).',
        strategy: 'cache-optimized',
      },
      {
        id: 'sys-bansos-reasoning',
        slug: 'bansos/reasoning',
        name: 'Bansos Deep Reasoning (R1 / Nemotron 550B / QwQ)',
        description: 'Prioritaskan model reasoning mendalam gratis (DeepSeek R1 671B, Nemotron 3 Ultra 550B, Gemini 2.5 Pro, QwQ 32B).',
        strategy: 'priority',
      },
      {
        id: 'sys-bansos-fast',
        slug: 'bansos/fast',
        name: 'Bansos Kilat LPU & Wafer-Scale (800–2,200 tok/s)',
        description: 'Prioritaskan Cerebras Wafer-Scale (2.200 tok/s), Groq LPU (800 tok/s), dan Gemini Flash.',
        strategy: 'latency-optimal',
      },
      {
        id: 'sys-bansos-1m',
        slug: 'bansos/million-context',
        name: 'Bansos 1 Juta Context Window',
        description: 'Khusus prompt raksasa: merutekan ke Gemini 2.5/3.8 Flash 1M, Nemotron 3 Ultra 1M, dan GLM 5.3 Flash 1M.',
        strategy: 'context-relay',
      },
      {
        id: 'sys-bansos-indo',
        slug: 'bansos/indo',
        name: 'Bansos Lokal Indonesia & ASEAN',
        description: 'Prioritaskan byNara Router Lokal, SEA-LION v3 70B ASEAN, Alibaba Singapore, dan Gemini Flash.',
        strategy: 'headroom',
      },
      {
        id: 'sys-auto',
        slug: 'auto',
        name: 'Auto Balanced Router',
        description: 'Real-time composite scoring across health, remaining quota, latency, and capability.',
        strategy: 'p2c',
      },
      {
        id: 'sys-auto-coding',
        slug: 'auto/coding',
        name: 'Auto Coding & Agentic (Claude Code / Codex)',
        description: 'Cache-optimized & tool-capable frontier coding models with automatic context-relay.',
        strategy: 'cache-optimized',
      },
      {
        id: 'sys-auto-fast',
        slug: 'auto/fast',
        name: 'Auto Ultra-Low Latency',
        description: 'Prioritizes Groq, Cerebras, Gemini Flash, and lowest-EWMA latency endpoints.',
        strategy: 'latency-optimal',
      },
      {
        id: 'sys-auto-cheap',
        slug: 'auto/cheap',
        name: 'Auto Cost-Optimized & Free-Tier First',
        description: 'Routes to $0 free-tier pools first.',
        strategy: 'cost-optimized',
      },
      {
        id: 'sys-auto-subscription',
        slug: 'auto/subscription',
        name: 'Auto OAuth Subscription Pool (Reset-Aware)',
        description: 'Drains OAuth accounts whose 5-hour/daily reset window is closest to expiring.',
        strategy: 'reset-aware',
      },
      {
        id: 'sys-auto-thrifty',
        slug: 'auto/thrifty',
        name: 'Auto Headroom & Thrifty Preserver',
        description: 'Preserves high-headroom accounts while maximizing daily free allocations.',
        strategy: 'headroom',
      },
      {
        id: 'sys-auto-smart',
        slug: 'auto/smart',
        name: 'Auto Frontier Reasoning',
        description: 'Targets highest-reasoning free models (Gemini 2.5 Pro, DeepSeek R1, Nemotron 550B).',
        strategy: 'priority',
      },
      {
        id: 'sys-auto-lkgp',
        slug: 'auto/lkgp',
        name: 'Auto Last Known Good Provider (LKGP)',
        description: 'Pins to the most recently verified zero-error connection in Cloudflare KV.',
        strategy: 'lkgp',
      },
    ];

    const seedStatements = systemCombos.map((c) =>
      d1
        .prepare(
          `INSERT OR IGNORE INTO combos (id, slug, name, description, strategy, candidates_json, compression_profile, sanitize_output, is_system, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, '[]', 'balanced', 1, 1, 1, ?, ?)`
        )
        .bind(c.id, c.slug, c.name, c.description, c.strategy, now, now)
    );

    seedStatements.push(
      d1
        .prepare(
          `INSERT OR IGNORE INTO domain_budgets (id, domain, daily_limit_usd, monthly_limit_usd, spent_today_usd, spent_month_usd, alert_threshold_percent, hard_cap_enabled, updated_at)
           VALUES ('budget-global', 'global', 50.0, 500.0, 0.0, 0.0, 80, 1, ?)`
        )
        .bind(now)
    );

    await d1.batch(seedStatements);
    schemaInitialized = true;
  } catch {
    // Non-fatal in read-only or mock environments
  }
}
