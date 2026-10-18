import { Hono } from 'hono';
import {
  ROUTING_STRATEGIES,
  COMPRESSION_LAYERS,
  COMPRESSION_PROFILES,
  VIRTUAL_AUTO_COMBOS,
  type FlareRouteEnv,
  type CompressionLayer,
} from '../types/env';
import type {
  ProviderConnectionRow,
  ComboRow,
  ModelAliasRow,
  ApiKeyRow,
  UsageLogRow,
  DomainBudgetRow,
  WebhookRow,
} from '../db/schema';
import {
  encryptCredentials,
  generateClientApiKey,
  sha256Hex,
} from '../lib/crypto';
import {
  FREE_TIER_CATALOG,
  MODEL_CATALOG,
  OAUTH_PROVIDER_CATALOG,
  PROVIDER_REGISTRY,
  PROVIDER_CATEGORIES,
  BANSOS_VERIFICATION_WATCHLIST,
  getTotalMonthlyBansosTokens,
  findProviderRegistryItem,
} from '../lib/catalogs';
import {
  listActiveResilienceStates,
  recordCandidateFailure,
} from '../lib/resilience';
import { runTokenCompressionPipeline } from '../lib/compression';
import { dispatchWebhookEvent } from '../lib/webhooks';
import { runScheduledMaintenance } from '../lib/oauth';
import { resolveAccountSdkPersona, SDK_FINGERPRINT_POOL } from '../sse/executor';

export const adminRouter = new Hono<{ Bindings: FlareRouteEnv }>();

/**
 * Admin Authentication Middleware (strictly requires valid session token or ADMIN_PASSWORD)
 */
adminRouter.use('*', async (c, next) => {
  if (c.req.path.endsWith('/login')) {
    return next();
  }
  const expectedPassword = c.env.ADMIN_PASSWORD;
  if (!expectedPassword) {
    return c.json({ error: 'Server misconfigured: ADMIN_PASSWORD secret not set' }, 500);
  }
  const expectedToken = await sha256Hex(`flareroute-admin:admin:${expectedPassword}`);
  const headerToken =
    c.req.header('x-admin-token') ??
    c.req.header('authorization')?.replace(/^Bearer\s+/i, '');

  if (headerToken && (headerToken === expectedPassword || headerToken === expectedToken)) {
    return next();
  }
  return c.json({ error: 'Unauthorized: Please sign in with admin credentials' }, 401);
});

adminRouter.post('/login', async (c) => {
  const body = (await c.req.json()) as { username?: string; password?: string };
  const expectedPassword = c.env.ADMIN_PASSWORD;
  const username = (body.username ?? 'admin').trim().toLowerCase();

  if (!expectedPassword || username !== 'admin' || body.password !== expectedPassword) {
    return c.json({ ok: false, error: 'Invalid username or password' }, 401);
  }
  const token = await sha256Hex(`flareroute-admin:admin:${expectedPassword}`);
  return c.json({
    ok: true,
    username: 'admin',
    token,
    version: c.env.FLAREROUTE_VERSION ?? '1.0.0-bansos',
  });
});

/**
 * Dashboard Overview & Real-Time Telemetry
 */
adminRouter.get('/overview', async (c) => {
  const [
    connectionsRes,
    combosRes,
    apiKeysRes,
    recentLogsRes,
    budgetsRes,
    webhooksRes,
    resilience,
    statsRow,
  ] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, name, provider, auth_type AS authType, account_label AS accountLabel,
              base_url AS baseUrl, priority, weight, tier, tos_risk AS tosRisk,
              daily_token_limit AS dailyTokenLimit, tokens_used_today AS tokensUsedToday,
              window_token_limit AS windowTokenLimit, tokens_used_window AS tokensUsedWindow,
              window_reset_at AS windowResetAt, token_expires_at AS tokenExpiresAt,
              status, consecutive_failures AS consecutiveFailures, avg_latency_ms AS avgLatencyMs,
              total_requests AS totalRequests, total_tokens AS totalTokens, total_cost_usd AS totalCostUsd,
              supported_models_json AS supportedModelsJson, metadata_json AS metadataJson,
              last_used_at AS lastUsedAt, last_error AS lastError, created_at AS createdAt
       FROM provider_connections ORDER BY priority ASC, created_at DESC`
    ).all<Omit<ProviderConnectionRow, 'encryptedCredentials' | 'updatedAt'>>(),
    c.env.DB.prepare(
      `SELECT id, slug, name, description, strategy, candidates_json AS candidatesJson,
              judge_model AS judgeModel, max_context_threshold AS maxContextThreshold,
              relay_target_model AS relayTargetModel, compression_profile AS compressionProfile,
              sanitize_output AS sanitizeOutput, cache_ttl_seconds AS cacheTtlSeconds,
              is_system AS isSystem, is_active AS isActive
       FROM combos ORDER BY is_system DESC, slug ASC`
    ).all<ComboRow>(),
    c.env.DB.prepare(
      `SELECT id, name, key_prefix AS keyPrefix, daily_budget_usd AS dailyBudgetUsd,
              monthly_budget_usd AS monthlyBudgetUsd, spent_today_usd AS spentTodayUsd,
              spent_month_usd AS spentMonthUsd, quota_share_percent AS quotaSharePercent,
              rate_limit_rpm AS rateLimitRpm, allowed_models_json AS allowedModelsJson,
              default_strategy AS defaultStrategy, compression_profile AS compressionProfile,
              pii_guard_enabled AS piiGuardEnabled, total_requests AS totalRequests,
              total_tokens_saved AS totalTokensSaved, is_active AS isActive, created_at AS createdAt
       FROM api_keys ORDER BY created_at DESC`
    ).all<Omit<ApiKeyRow, 'keyHash'>>(),
    c.env.DB.prepare(
      `SELECT id, request_id AS requestId, provider, model_requested AS modelRequested,
              model_used AS modelUsed, strategy_used AS strategyUsed, inbound_protocol AS inboundProtocol,
              prompt_tokens AS promptTokens, completion_tokens AS completionTokens,
              cached_tokens AS cachedTokens, tokens_saved AS tokensSaved,
              compression_layers_json AS compressionLayersJson, cost_usd AS costUsd,
              latency_ms AS latencyMs, status_code AS statusCode, is_stream AS isStream,
              created_at AS createdAt
       FROM usage_logs ORDER BY created_at DESC LIMIT 40`
    ).all<UsageLogRow>(),
    c.env.DB.prepare(
      `SELECT id, domain, daily_limit_usd AS dailyLimitUsd, monthly_limit_usd AS monthlyLimitUsd,
              spent_today_usd AS spentTodayUsd, spent_month_usd AS spentMonthUsd,
              alert_threshold_percent AS alertThresholdPercent, hard_cap_enabled AS hardCapEnabled
       FROM domain_budgets`
    ).all<DomainBudgetRow>(),
    c.env.DB.prepare(
      `SELECT id, name, type, target_url AS targetUrl, events_json AS eventsJson,
              is_active AS isActive, last_triggered_at AS lastTriggeredAt, last_status AS lastStatus
       FROM webhooks ORDER BY created_at DESC`
    ).all<WebhookRow>(),
    listActiveResilienceStates(c.env.FLAREROUTE_KV),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS totalRequests,
              COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS totalTokens,
              COALESCE(SUM(tokens_saved), 0) AS totalTokensSaved,
              COALESCE(SUM(cached_tokens), 0) AS totalCachedTokens,
              0 AS totalCostUsd,
              COALESCE(AVG(latency_ms), 0) AS avgLatencyMs
       FROM usage_logs`
    ).first<{
      totalRequests: number;
      totalTokens: number;
      totalTokensSaved: number;
      totalCachedTokens: number;
      totalCostUsd: number;
      avgLatencyMs: number;
    }>(),
  ]);

  const enrichedConnections = connectionsRes.results.map((conn) => {
    const persona = resolveAccountSdkPersona(conn.id, conn.provider, conn.metadataJson);
    return {
      ...conn,
      sdkPersona: persona.label,
      sdkPersonaSlot: persona.slot,
    };
  });

  return c.json({
    stats: statsRow ?? {
      totalRequests: 0,
      totalTokens: 0,
      totalTokensSaved: 0,
      totalCachedTokens: 0,
      totalCostUsd: 0,
      avgLatencyMs: 0,
    },
    connections: enrichedConnections,
    combos: combosRes.results,
    apiKeys: apiKeysRes.results,
    recentLogs: recentLogsRes.results,
    budgets: budgetsRes.results,
    webhooks: webhooksRes.results,
    resilience,
    catalogs: {
      strategies: ROUTING_STRATEGIES,
      virtualAutoCombos: VIRTUAL_AUTO_COMBOS,
      compressionLayers: COMPRESSION_LAYERS,
      compressionProfiles: COMPRESSION_PROFILES,
      models: MODEL_CATALOG,
      freeTiers: FREE_TIER_CATALOG,
      oauthProviders: OAUTH_PROVIDER_CATALOG,
      providerRegistry: PROVIDER_REGISTRY,
      providerCategories: PROVIDER_CATEGORIES,
      bansosWatchlist: BANSOS_VERIFICATION_WATCHLIST,
      totalMonthlyBansosTokens: getTotalMonthlyBansosTokens(),
    },
  });
});

/**
 * Provider Connections CRUD (encrypts credentials via WebCrypto AES-256-GCM)
 */
adminRouter.post('/connections', async (c) => {
  const body = (await c.req.json()) as {
    name?: string;
    provider?: string;
    authType?: string;
    apiKey?: string;
    accessToken?: string;
    refreshToken?: string;
    serviceAccountEmail?: string;
    privateKeyPem?: string;
    accountLabel?: string;
    baseUrl?: string;
    priority?: number;
    weight?: number;
    tier?: string;
    tosRisk?: string;
    dailyTokenLimit?: number;
    windowTokenLimit?: number;
    supportedModels?: string[];
  };

  const now = Date.now();
  const id = `conn_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const provider = body.provider ?? 'gemini';
  const regItem = findProviderRegistryItem(provider);
  const encrypted = await encryptCredentials(
    {
      apiKey: body.apiKey?.trim() || 'bansos-zero-key',
      accessToken: body.accessToken?.trim(),
      refreshToken: body.refreshToken?.trim(),
      serviceAccountEmail: body.serviceAccountEmail?.trim(),
      privateKeyPem: body.privateKeyPem?.trim(),
    },
    c.env.ENCRYPTION_SECRET
  );

  // Assign a unique SDK Fingerprint Slot (0..15) among existing accounts of the same provider
  const siblingRows = await c.env.DB.prepare(
    `SELECT id, metadata_json AS metadataJson FROM provider_connections WHERE provider = ?`
  )
    .bind(provider)
    .all<{ id: string; metadataJson: string }>();

  const usedSlots = new Set<number>();
  for (const row of siblingRows.results) {
    const existingPersona = resolveAccountSdkPersona(row.id, provider, row.metadataJson);
    usedSlots.add(existingPersona.slot);
  }
  let assignedSlot = siblingRows.results.length % SDK_FINGERPRINT_POOL.length;
  for (let candidate = 0; candidate < SDK_FINGERPRINT_POOL.length; candidate++) {
    if (!usedSlots.has(candidate)) {
      assignedSlot = candidate;
      break;
    }
  }
  const assignedPersona = resolveAccountSdkPersona(
    id,
    provider,
    JSON.stringify({ personaSlot: assignedSlot })
  );

  const windowResetAt = now + 5 * 3600 * 1000;
  const resolvedModels =
    body.supportedModels && body.supportedModels.length > 0
      ? body.supportedModels
      : regItem?.defaultModels ?? ['gemini-2.5-flash'];

  await c.env.DB.prepare(
    `INSERT INTO provider_connections (
      id, name, provider, auth_type, encrypted_credentials, account_label, base_url,
      priority, weight, tier, tos_risk, daily_token_limit, tokens_used_today,
      window_token_limit, tokens_used_window, window_reset_at, status,
      supported_models_json, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'free', ?, ?, 0, ?, 0, ?, 'active', ?, ?, ?, ?)`
  )
    .bind(
      id,
      body.name?.trim() || `${regItem?.name ?? provider.toUpperCase()} Bansos`,
      provider,
      body.authType ?? regItem?.authType ?? 'api_key',
      encrypted,
      body.accountLabel?.trim() || 'bansos-primary',
      body.baseUrl?.trim() || (regItem?.baseUrl && !regItem.baseUrl.startsWith('binding://') ? regItem.baseUrl : null),
      body.priority ?? 50,
      body.weight ?? 100,
      body.tosRisk ?? regItem?.tosRisk ?? 'safe',
      body.dailyTokenLimit ?? 1500000,
      body.windowTokenLimit ?? 500000,
      windowResetAt,
      JSON.stringify(resolvedModels),
      JSON.stringify({ personaSlot: assignedSlot }),
      now,
      now
    )
    .run();

  return c.json({
    ok: true,
    id,
    sdkPersona: assignedPersona.label,
    sdkPersonaSlot: assignedPersona.slot,
  });
});

/**
 * One-click seed 100% Free Bansos starter connections
 * (Cloudflare Workers AI Zero-Key + Gemini AI Studio + Groq LPU + Cerebras Wafer-Scale + NVIDIA NIM + Z.AI GLM Flash + Pollinations Zero-Key)
 */
adminRouter.post('/connections/seed-demo', async (c) => {
  const now = Date.now();
  const encrypted = await encryptCredentials(
    { apiKey: 'bansos-demo-free-key' },
    c.env.ENCRYPTION_SECRET
  );
  const fiveHours = now + 5 * 3600 * 1000;

  const starterConns = [
    {
      id: 'conn_bansos_gemini_free',
      name: 'Google AI Studio Free (1M Context • No CC)',
      provider: 'gemini',
      authType: 'api_key',
      tier: 'free',
      tosRisk: 'safe',
      priority: 10,
      daily: 5000000,
      window: 1000000,
      models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3.8-flash', 'gemma-4-31b'],
    },
    {
      id: 'conn_bansos_groq_lpu',
      name: 'Groq Cloud LPU Free (14,400 RPD • No CC)',
      provider: 'groq',
      authType: 'api_key',
      tier: 'free',
      tosRisk: 'safe',
      priority: 20,
      daily: 2000000,
      window: 500000,
      models: ['llama-3.3-70b-versatile', 'moonshotai/kimi-k2-instruct', 'deepseek-r1-distill-llama-70b', 'qwen-qwq-32b'],
    },
    {
      id: 'conn_bansos_cerebras',
      name: 'Cerebras Wafer-Scale Free (2,200 tok/s • 1M/Day)',
      provider: 'cerebras',
      authType: 'api_key',
      tier: 'free',
      tosRisk: 'safe',
      priority: 25,
      daily: 1000000,
      window: 400000,
      models: ['qwen-2.5-coder-32b', 'llama-3.3-70b'],
    },
    {
      id: 'conn_bansos_nvidia_nim',
      name: 'NVIDIA NIM Free (40 RPM • 134 Free Models)',
      provider: 'nvidia',
      authType: 'api_key',
      tier: 'free',
      tosRisk: 'safe',
      priority: 30,
      daily: 2500000,
      window: 600000,
      models: ['nvidia/nemotron-3-ultra-550b-a55b', 'deepseek-ai/deepseek-v4-pro', 'z-ai/glm-5.3-flash'],
    },
    {
      id: 'conn_bansos_zhipu_flash',
      name: 'Z.AI GLM-4.7-Flash (100% Permanent Free • No CC)',
      provider: 'bigmodel',
      authType: 'api_key',
      tier: 'free',
      tosRisk: 'safe',
      priority: 35,
      daily: 3000000,
      window: 800000,
      models: ['glm-4-flash'],
    },
    {
      id: 'conn_bansos_workers_ai',
      name: 'Cloudflare Workers AI (Zero-Key Edge • 10K Neurons/Day)',
      provider: 'workers-ai',
      authType: 'workers_ai',
      tier: 'free',
      tosRisk: 'safe',
      priority: 40,
      daily: 500000,
      window: 200000,
      models: ['@cf/meta/llama-3.3-70b-instruct-fp8-fast'],
    },
    {
      id: 'conn_bansos_pollinations',
      name: 'Pollinations.ai Zero-Key Free Endpoint',
      provider: 'pollinations-free',
      authType: 'no_auth',
      tier: 'free',
      tosRisk: 'safe',
      priority: 45,
      daily: 1000000,
      window: 300000,
      models: ['openai', 'deepseek-r1'],
    },
  ];

  await c.env.DB.batch(
    starterConns.map((sc) =>
      c.env.DB.prepare(
        `INSERT OR REPLACE INTO provider_connections (
          id, name, provider, auth_type, encrypted_credentials, account_label,
          priority, weight, tier, tos_risk, daily_token_limit, tokens_used_today,
          window_token_limit, tokens_used_window, window_reset_at, token_expires_at,
          status, avg_latency_ms, supported_models_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 100, ?, ?, ?, 8400, ?, 2400, ?, ?, 'active', 185, ?, ?, ?)`
      ).bind(
        sc.id,
        sc.name,
        sc.provider,
        sc.authType,
        encrypted,
        sc.name,
        sc.priority,
        sc.tier,
        sc.tosRisk,
        sc.daily,
        sc.window,
        fiveHours,
        fiveHours,
        JSON.stringify(sc.models),
        now,
        now
      )
    )
  );

  return c.json({ ok: true, seeded: starterConns.length });
});

adminRouter.patch('/connections/:id', async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.json()) as {
    status?: string;
    name?: string;
    priority?: number;
    baseUrl?: string | null;
  };
  await c.env.DB.prepare(
    `UPDATE provider_connections
     SET status = COALESCE(?, status),
         name = COALESCE(?, name),
         priority = COALESCE(?, priority),
         base_url = COALESCE(?, base_url),
         updated_at = ?
     WHERE id = ?`
  )
    .bind(
      body.status ?? null,
      body.name ?? null,
      body.priority ?? null,
      body.baseUrl !== undefined ? body.baseUrl : null,
      Date.now(),
      id
    )
    .run();
  return c.json({ ok: true });
});

adminRouter.delete('/connections/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare(`DELETE FROM provider_connections WHERE id = ?`).bind(id).run();
  return c.json({ ok: true });
});

/**
 * Combos & 19-Strategy Visual Builder CRUD
 */
adminRouter.post('/combos', async (c) => {
  const body = (await c.req.json()) as {
    slug: string;
    name: string;
    description?: string;
    strategy: string;
    candidates?: unknown[];
    judgeModel?: string;
    maxContextThreshold?: number;
    relayTargetModel?: string;
    compressionProfile?: string;
    sanitizeOutput?: boolean;
    cacheTtlSeconds?: number;
  };

  const now = Date.now();
  const id = `combo_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`;

  await c.env.DB.prepare(
    `INSERT OR REPLACE INTO combos (
      id, slug, name, description, strategy, candidates_json, judge_model,
      max_context_threshold, relay_target_model, compression_profile,
      sanitize_output, cache_ttl_seconds, is_system, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)`
  )
    .bind(
      id,
      body.slug.trim(),
      body.name.trim(),
      body.description?.trim() ?? '',
      body.strategy || 'p2c',
      JSON.stringify(body.candidates ?? []),
      body.judgeModel ?? null,
      body.maxContextThreshold ?? 128000,
      body.relayTargetModel ?? 'gemini-2.5-pro',
      body.compressionProfile ?? 'balanced',
      body.sanitizeOutput === false ? 0 : 1,
      body.cacheTtlSeconds ?? 0,
      now,
      now
    )
    .run();

  return c.json({ ok: true, id });
});

adminRouter.patch('/combos/:id', async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.json()) as {
    strategy?: string;
    compressionProfile?: string;
    cacheTtlSeconds?: number;
  };
  await c.env.DB.prepare(
    `UPDATE combos
     SET strategy = COALESCE(?, strategy),
         compression_profile = COALESCE(?, compression_profile),
         cache_ttl_seconds = COALESCE(?, cache_ttl_seconds),
         updated_at = ?
     WHERE id = ? OR slug = ?`
  )
    .bind(
      body.strategy ?? null,
      body.compressionProfile ?? null,
      body.cacheTtlSeconds ?? null,
      Date.now(),
      id,
      id
    )
    .run();
  return c.json({ ok: true });
});

adminRouter.delete('/combos/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare(`DELETE FROM combos WHERE id = ? AND is_system = 0`).bind(id).run();
  return c.json({ ok: true });
});

/**
 * Client API Keys (`fr_live_...`) & USD Budgets CRUD
 */
adminRouter.post('/api-keys', async (c) => {
  const body = (await c.req.json()) as {
    name?: string;
    dailyBudgetUsd?: number;
    monthlyBudgetUsd?: number;
    quotaSharePercent?: number;
    rateLimitRpm?: number;
    allowedModels?: string[];
    defaultStrategy?: string;
    compressionProfile?: string;
    piiGuardEnabled?: boolean;
  };

  const { rawKey, keyPrefix, keyHash } = await generateClientApiKey();
  const id = `key_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`;
  const now = Date.now();

  await c.env.DB.prepare(
    `INSERT INTO api_keys (
      id, name, key_prefix, key_hash, daily_budget_usd, monthly_budget_usd,
      spent_today_usd, spent_month_usd, quota_share_percent, rate_limit_rpm,
      allowed_models_json, default_strategy, compression_profile, pii_guard_enabled,
      total_requests, total_tokens_saved, is_active, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, 0, 0, 1, ?)`
  )
    .bind(
      id,
      body.name?.trim() || 'Production Client Key',
      keyPrefix,
      keyHash,
      body.dailyBudgetUsd ?? 10.0,
      body.monthlyBudgetUsd ?? 100.0,
      body.quotaSharePercent ?? 100,
      body.rateLimitRpm ?? 120,
      JSON.stringify(body.allowedModels ?? ['*']),
      body.defaultStrategy ?? 'auto',
      body.compressionProfile ?? 'balanced',
      body.piiGuardEnabled === false ? 0 : 1,
      now
    )
    .run();

  return c.json({
    ok: true,
    id,
    rawKey,
    keyPrefix,
  });
});

adminRouter.patch('/api-keys/:id', async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.json()) as { isActive?: boolean; name?: string };
  await c.env.DB.prepare(
    `UPDATE api_keys
     SET is_active = COALESCE(?, is_active),
         name = COALESCE(?, name)
     WHERE id = ?`
  )
    .bind(
      body.isActive === undefined ? null : body.isActive ? 1 : 0,
      body.name ?? null,
      id
    )
    .run();
  return c.json({ ok: true });
});

adminRouter.delete('/api-keys/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare(`DELETE FROM api_keys WHERE id = ?`).bind(id).run();
  return c.json({ ok: true });
});

/**
 * Model Aliases CRUD
 */
adminRouter.post('/aliases', async (c) => {
  const body = (await c.req.json()) as {
    sourceModel: string;
    targetModel: string;
    targetProvider?: string;
    description?: string;
  };
  const id = `alias_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  await c.env.DB.prepare(
    `INSERT OR REPLACE INTO model_aliases (id, source_model, target_model, target_provider, description, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`
  )
    .bind(
      id,
      body.sourceModel.trim(),
      body.targetModel.trim(),
      body.targetProvider?.trim() || null,
      body.description?.trim() ?? '',
      Date.now()
    )
    .run();
  return c.json({ ok: true, id });
});

/**
 * Webhooks CRUD & Test Trigger
 */
adminRouter.post('/webhooks', async (c) => {
  const body = (await c.req.json()) as {
    name: string;
    type: string;
    targetUrl: string;
    secretHeader?: string;
    events?: string[];
  };
  const id = `wh_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  await c.env.DB.prepare(
    `INSERT INTO webhooks (id, name, type, target_url, secret_header, events_json, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
  )
    .bind(
      id,
      body.name.trim(),
      body.type || 'discord',
      body.targetUrl.trim(),
      body.secretHeader?.trim() || null,
      JSON.stringify(
        body.events ?? [
          'circuit_open',
          'budget_exceeded',
          'oauth_refresh_failed',
          'model_lockout',
        ]
      ),
      Date.now()
    )
    .run();
  return c.json({ ok: true, id });
});

adminRouter.post('/webhooks/test', async (c) => {
  await dispatchWebhookEvent(c.env.DB, {
    event: 'test_ping',
    title: 'FlareRoute Webhook Test Ping',
    message: 'Non-blocking outbound webhook delivery from Cloudflare Worker verified.',
  });
  return c.json({ ok: true });
});

adminRouter.delete('/webhooks/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare(`DELETE FROM webhooks WHERE id = ?`).bind(id).run();
  return c.json({ ok: true });
});

/**
 * 3-Layer Resilience Controls (Reset Lockouts & Simulate Per-Model Lockout)
 */
adminRouter.post('/resilience/reset', async (c) => {
  const [cb, cd, lk] = await Promise.all([
    c.env.FLAREROUTE_KV.list({ prefix: 'cb:provider:' }),
    c.env.FLAREROUTE_KV.list({ prefix: 'cd:conn:' }),
    c.env.FLAREROUTE_KV.list({ prefix: 'lock:conn:' }),
  ]);
  const allKeys = [...cb.keys, ...cd.keys, ...lk.keys];
  await Promise.all(allKeys.map((k) => c.env.FLAREROUTE_KV.delete(k.name)));
  await c.env.DB.prepare(
    `UPDATE provider_connections SET status = 'active', consecutive_failures = 0`
  ).run();
  return c.json({ ok: true, cleared: allKeys.length });
});

adminRouter.post('/resilience/simulate-lockout', async (c) => {
  const body = (await c.req.json()) as {
    connectionId: string;
    provider: string;
    model: string;
  };
  const outcome = await recordCandidateFailure(c.env.FLAREROUTE_KV, c.env.DB, {
    provider: body.provider || 'anthropic',
    connectionId: body.connectionId,
    model: body.model || 'claude-opus-4-6',
    statusCode: 429,
    errorMessage: `Rate limit exceeded for model ${body.model}: Layer 3 Per-Model Lockout activated (sibling models on this account remain unlocked!)`,
    isModelSpecificError: true,
  });
  return c.json({ ok: true, outcome });
});

/**
 * Interactive 10-Layer Token Compression Studio Simulator
 */
adminRouter.post('/compression/simulate', async (c) => {
  const body = (await c.req.json()) as {
    prompt?: string;
    systemPrompt?: string;
    profile?: string;
    customLayers?: CompressionLayer[];
  };

  const sampleText =
    body.prompt ??
    `Could you please kindly review this JSON payload and test output? Thank you so much in advance!\n\n` +
      JSON.stringify([
        { id: 101, service: 'auth-worker', status: 'healthy', latency_ms: 12, region: 'SJC' },
        { id: 102, service: 'edge-router', status: 'healthy', latency_ms: 8, region: 'LAX' },
        { id: 103, service: 'kv-sync', status: 'degraded', latency_ms: 94, region: 'IAD' },
        { id: 104, service: 'd1-writer', status: 'healthy', latency_ms: 15, region: 'FRA' },
      ]) +
      `\n\nPASS src/test/auth.spec.ts\n✓ test case 1\n✓ test case 2\n✓ test case 3\n✓ test case 4\n✓ test case 5\n✓ test case 6`;

  const result = await runTokenCompressionPipeline(
    {
      model: 'auto/coding',
      inboundProtocol: 'openai-chat',
      stream: false,
      systemPrompt: body.systemPrompt,
      messages: [{ role: 'user', content: sampleText }],
    },
    c.env.FLAREROUTE_KV,
    body.profile ?? 'balanced',
    body.customLayers
  );

  return c.json({
    originalText: sampleText,
    compressedText: result.request.messages[0]?.content ?? '',
    stats: result.stats,
  });
});

/**
 * Trigger Cron Maintenance manually from Dashboard
 */
adminRouter.post('/cron/run', async (c) => {
  const res = await runScheduledMaintenance(c.env);
  return c.json({ ok: true, ...res });
});
