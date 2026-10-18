import type {
  D1Database,
  KVNamespace,
  RoutingStrategy,
  ComboCandidate,
} from '../types/env';
import type { ProviderConnectionRow, ComboRow, ModelAliasRow } from '../db/schema';
import { checkCandidateResilience } from './resilience';
import { findModelSpec, MODEL_CATALOG } from './catalogs';
import { sha256Hex } from './crypto';

export interface ResolvedCandidate {
  connection: ProviderConnectionRow;
  model: string;
  provider: string;
  strategyUsed: RoutingStrategy;
  score: number;
  reason: string;
}

export interface RouteResolutionResult {
  primary: ResolvedCandidate;
  fallbacks: ResolvedCandidate[];
  strategyUsed: RoutingStrategy;
  isFusion: boolean;
  isPipeline: boolean;
  judgeModel?: string | null;
  compressionProfile: string;
  sanitizeOutput: boolean;
  cacheTtlSeconds: number;
}

export interface RouteRequestContext {
  requestedModel: string;
  estimatedPromptTokens: number;
  prefixHashInput: string; // System prompt + early turns for cache-optimized prefix affinity
  requiresTools?: boolean;
  requiresVision?: boolean;
  requiresThinking?: boolean;
  apiKeyQuotaSharePercent?: number;
  preferredStrategy?: string;
}

function parseJsonStringArray(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === 'string');
    }
  } catch {
    // ignore
  }
  return [];
}

function parseComboCandidates(raw: string): ComboCandidate[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as ComboCandidate[];
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * Determine default model for a given provider connection if none was explicitly listed
 */
export function getDefaultModelForProvider(provider: string, supportedModelsJson: string): string {
  const customModels = parseJsonStringArray(supportedModelsJson);
  if (customModels.length > 0) return customModels[0];

  switch (provider) {
    case 'gemini':
    case 'gemini-cli':
    case 'antigravity':
      return 'gemini-2.5-flash';
    case 'groq':
      return 'llama-3.3-70b-versatile';
    case 'cerebras':
    case 'qwen':
      return 'qwen-2.5-coder-32b';
    case 'openrouter':
    case 'chutes':
      return 'deepseek-r1';
    case 'nvidia':
      return 'nvidia/nemotron-3-ultra-550b-a55b';
    case 'mistral':
    case 'codestral':
      return 'codestral-latest';
    case 'bigmodel':
    case 'zai':
      return 'glm-4-flash';
    case 'workers-ai':
    case 'cloudflare-playground':
      return '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
    case 'github-models':
      return 'gpt-4o';
    case 'cohere':
      return 'command-a-03-2025';
    case 'modelscope':
      return 'Qwen/Qwen3-235B-A22B';
    case 'siliconflow':
      return 'Qwen/Qwen3-8B';
    case 'sambanova':
      return 'DeepSeek-R1';
    case 'llm7':
    case 'llm7-free':
      return 'gpt-4o-mini';
    case 'opencode-zen':
      return 'big-pickle';
    case 'ovhcloud':
      return 'qwen3.5-397b-a17b';
    case 'hetzner':
      return 'qwen3.6-35b-a3b';
    case 'pollinations':
    case 'pollinations-free':
      return 'openai';
    case 'sealion':
      return 'aisingapore/Llama-SEA-LION-v3-70B-IT';
    case 'bynara':
      return 'bynara-free-auto';
    case 'artbloom':
    case 'kiro':
      return 'claude-sonnet-4-6';
    default:
      return 'gemini-2.5-flash';
  }
}

const NO_CC_PROVIDERS = new Set([
  'gemini',
  'gemini-cli',
  'groq',
  'cerebras',
  'workers-ai',
  'cloudflare-playground',
  'openrouter',
  'bigmodel',
  'zai',
  'github-models',
  'cohere',
  'siliconflow',
  'sambanova',
  'qwen',
  'llm7',
  'llm7-free',
  'opencode-zen',
  'kilocode',
  'ovhcloud',
  'hetzner',
  'pollinations',
  'pollinations-free',
  'aionlabs',
  'requesty',
  'freeai',
  'bazaarlink',
  'agnes',
  'together',
  'huggingface',
  'chutes',
  'sealion',
  'bynara',
]);

/**
 * Resolve model aliases, virtual `bansos/*` & `auto/*` combos, custom combos, and 19 routing strategies.
 */
export async function resolveRoute(
  d1: D1Database,
  kv: KVNamespace,
  ctx: RouteRequestContext
): Promise<RouteResolutionResult> {
  // 1. Check Model Aliases first
  const aliasRow = await d1
    .prepare(
      `SELECT id, source_model AS sourceModel, target_model AS targetModel, target_provider AS targetProvider, description, is_active AS isActive, created_at AS createdAt
       FROM model_aliases WHERE source_model = ? AND is_active = 1 LIMIT 1`
    )
    .bind(ctx.requestedModel)
    .first<ModelAliasRow>();

  const targetModelOrCombo = aliasRow ? aliasRow.targetModel : ctx.requestedModel;
  const forcedProvider = aliasRow?.targetProvider ?? null;

  // 2. Check if target matches a Combo (including `bansos/*`, `auto`, `auto/coding`, `auto/fast`, etc.)
  const comboRow = await d1
    .prepare(
      `SELECT id, slug, name, description, strategy, candidates_json AS candidatesJson, judge_model AS judgeModel,
              judge_connection_id AS judgeConnectionId, max_context_threshold AS maxContextThreshold,
              relay_target_model AS relayTargetModel, compression_profile AS compressionProfile,
              custom_compression_layers_json AS customCompressionLayersJson, sanitize_output AS sanitizeOutput,
              cache_ttl_seconds AS cacheTtlSeconds, is_system AS isSystem, is_active AS isActive,
              created_at AS createdAt, updated_at AS updatedAt
       FROM combos WHERE slug = ? AND is_active = 1 LIMIT 1`
    )
    .bind(targetModelOrCombo)
    .first<ComboRow>();

  // 3. Load all active or cooldown connections from D1
  const connectionsResult = await d1
    .prepare(
      `SELECT id, name, provider, auth_type AS authType, encrypted_credentials AS encryptedCredentials,
              account_label AS accountLabel, base_url AS baseUrl, priority, weight, tier, tos_risk AS tosRisk,
              daily_token_limit AS dailyTokenLimit, tokens_used_today AS tokensUsedToday,
              window_token_limit AS windowTokenLimit, tokens_used_window AS tokensUsedWindow,
              window_reset_at AS windowResetAt, token_expires_at AS tokenExpiresAt,
              status, consecutive_failures AS consecutiveFailures, avg_latency_ms AS avgLatencyMs,
              total_requests AS totalRequests, total_tokens AS totalTokens, total_cost_usd AS totalCostUsd,
              supported_models_json AS supportedModelsJson, metadata_json AS metadataJson,
              last_used_at AS lastUsedAt, last_error AS lastError, created_at AS createdAt, updated_at AS updatedAt
       FROM provider_connections
       WHERE status != 'disabled'
       ORDER BY priority ASC, avg_latency_ms ASC`
    )
    .all<ProviderConnectionRow>();

  const allConnections = connectionsResult.results;

  // Determine effective strategy
  let strategy: RoutingStrategy =
    (comboRow?.strategy as RoutingStrategy | undefined) ??
    (ctx.preferredStrategy as RoutingStrategy | undefined) ??
    'thrifty';

  if (targetModelOrCombo === 'auto/coding' || targetModelOrCombo === 'bansos/coding')
    strategy = 'cache-optimized';
  else if (targetModelOrCombo === 'auto/fast' || targetModelOrCombo === 'bansos/fast')
    strategy = 'latency-optimal';
  else if (targetModelOrCombo === 'auto/cheap' || targetModelOrCombo === 'bansos/no-cc')
    strategy = 'cost-optimized';
  else if (targetModelOrCombo === 'auto/subscription') strategy = 'reset-aware';
  else if (targetModelOrCombo === 'auto/thrifty' || targetModelOrCombo === 'bansos/auto')
    strategy = 'thrifty';
  else if (targetModelOrCombo === 'auto/smart' || targetModelOrCombo === 'bansos/reasoning')
    strategy = 'priority';
  else if (targetModelOrCombo === 'bansos/million-context') strategy = 'context-relay';
  else if (targetModelOrCombo === 'bansos/indo') strategy = 'headroom';
  else if (targetModelOrCombo === 'auto/lkgp') strategy = 'lkgp';

  // Build candidate pool
  const candidatePool: Array<{
    connection: ProviderConnectionRow;
    model: string;
    provider: string;
  }> = [];

  const explicitCandidates = comboRow ? parseComboCandidates(comboRow.candidatesJson) : [];

  if (explicitCandidates.length > 0) {
    for (const ec of explicitCandidates) {
      const matchingConns = allConnections.filter(
        (c) => (ec.connectionId ? c.id === ec.connectionId : c.provider === ec.provider)
      );
      for (const conn of matchingConns) {
        candidatePool.push({
          connection: conn,
          model: ec.model,
          provider: conn.provider,
        });
      }
    }
  }

  // If no explicit combo candidates matched, build dynamic candidate pool from active connections
  if (candidatePool.length === 0) {
    const isAutoCombo =
      targetModelOrCombo === 'auto' ||
      targetModelOrCombo.startsWith('auto/') ||
      targetModelOrCombo.startsWith('bansos/');

    let parsedProvider = forcedProvider;
    let parsedModel = targetModelOrCombo;
    if (!isAutoCombo && targetModelOrCombo.includes('/') && !targetModelOrCombo.startsWith('@cf/')) {
      const slashIdx = targetModelOrCombo.indexOf('/');
      const prefix = targetModelOrCombo.slice(0, slashIdx);
      if (allConnections.some((c) => c.provider === prefix)) {
        parsedProvider = prefix;
        parsedModel = targetModelOrCombo.slice(slashIdx + 1);
      }
    }

    for (const conn of allConnections) {
      if (parsedProvider && conn.provider !== parsedProvider) continue;
      if (targetModelOrCombo === 'bansos/no-cc' && !NO_CC_PROVIDERS.has(conn.provider)) continue;

      const supported = parseJsonStringArray(conn.supportedModelsJson);
      let candidateModel = parsedModel;

      if (isAutoCombo) {
        candidateModel = getDefaultModelForProvider(conn.provider, conn.supportedModelsJson);
        if (
          (targetModelOrCombo === 'auto/smart' || targetModelOrCombo === 'bansos/reasoning') &&
          (conn.provider === 'gemini' || conn.provider === 'gemini-cli')
        ) {
          candidateModel = supported.includes('gemini-2.5-pro') ? 'gemini-2.5-pro' : candidateModel;
        } else if (
          targetModelOrCombo === 'bansos/million-context' &&
          !['gemini', 'gemini-cli', 'nvidia', 'openrouter', 'hetzner'].includes(conn.provider)
        ) {
          continue;
        } else if (
          targetModelOrCombo === 'bansos/indo' &&
          ['sealion', 'bynara', 'gemini', 'groq', 'alibaba'].includes(conn.provider)
        ) {
          candidateModel = getDefaultModelForProvider(conn.provider, conn.supportedModelsJson);
        }
      } else if (supported.length > 0 && !supported.includes(parsedModel)) {
        const spec = MODEL_CATALOG.find((m) => m.id === parsedModel);
        if (spec && spec.provider !== conn.provider) {
          continue;
        }
      }

      candidatePool.push({
        connection: conn,
        model: candidateModel,
        provider: conn.provider,
      });
    }

    // Fallback: if user asked for a specific model or specialized combo and only other providers are connected,
    // allow any active connection using its default free model so requests never fail unnecessarily.
    if (candidatePool.length === 0 && allConnections.length > 0) {
      for (const conn of allConnections) {
        candidatePool.push({
          connection: conn,
          model: getDefaultModelForProvider(conn.provider, conn.supportedModelsJson),
          provider: conn.provider,
        });
      }
    }
  }

  // Filter candidates through the 3-Layer Resilience Engine (Circuit Breaker, Cooldown, Per-Model Lockout)
  const healthyCandidates: Array<{
    connection: ProviderConnectionRow;
    model: string;
    provider: string;
  }> = [];

  for (const item of candidatePool) {
    const resilience = await checkCandidateResilience(
      kv,
      item.provider,
      item.connection.id,
      item.model
    );
    if (resilience.healthy) {
      healthyCandidates.push(item);
    }
  }

  // Self-healing fallback: if every single candidate is in cooldown/lockout, allow half-open probe on allPool
  const activePool = healthyCandidates.length > 0 ? healthyCandidates : candidatePool;

  if (activePool.length === 0) {
    throw new Error(
      'No provider connections configured. Add an API Key, Free-Tier provider, or OAuth account in the FlareRoute Dashboard (/dashboard).'
    );
  }

  // Context-Relay check (Strategy #13 or automatic large-prompt protection)
  const contextThreshold = comboRow?.maxContextThreshold ?? 128000;
  if (
    (strategy === 'context-relay' || ctx.estimatedPromptTokens > contextThreshold) &&
    ctx.estimatedPromptTokens > 100000
  ) {
    const longContextPool = activePool.filter((c) => {
      const spec = findModelSpec(c.model);
      return spec.contextWindow >= ctx.estimatedPromptTokens || c.provider === 'gemini' || c.provider === 'gemini-cli';
    });
    if (longContextPool.length > 0) {
      strategy = 'context-relay';
      activePool.splice(0, activePool.length, ...longContextPool);
    }
  }

  // Score and sort candidates according to the active RoutingStrategy (1 of 19)
  const scored = await scoreCandidatesByStrategy(
    kv,
    strategy,
    targetModelOrCombo,
    activePool,
    ctx
  );

  // If `cache-optimized`, persist prefix affinity mapping in KV
  if (strategy === 'cache-optimized' && ctx.prefixHashInput.length > 0 && scored.length > 0) {
    const prefixHash = await sha256Hex(ctx.prefixHashInput.slice(0, 2048));
    await kv.put(
      `aff:prefix:${prefixHash}`,
      JSON.stringify({
        connectionId: scored[0].connection.id,
        model: scored[0].model,
      }),
      { expirationTtl: 1800 }
    );
  }

  return {
    primary: scored[0],
    fallbacks: scored.slice(1, 5),
    strategyUsed: strategy,
    isFusion: strategy === 'fusion',
    isPipeline: strategy === 'pipeline',
    judgeModel: comboRow?.judgeModel ?? null,
    compressionProfile: comboRow?.compressionProfile ?? 'balanced',
    sanitizeOutput: comboRow ? Boolean(comboRow.sanitizeOutput) : true,
    cacheTtlSeconds: comboRow?.cacheTtlSeconds ?? 0,
  };
}

/**
 * Evaluate and order candidates using all 19 Routing Strategies
 */
async function scoreCandidatesByStrategy(
  kv: KVNamespace,
  strategy: RoutingStrategy,
  comboSlug: string,
  pool: Array<{ connection: ProviderConnectionRow; model: string; provider: string }>,
  ctx: RouteRequestContext
): Promise<ResolvedCandidate[]> {
  const now = Date.now();

  // Pre-fetch KV states needed by stateful strategies (`cache-optimized`, `lkgp`, `round-robin`)
  let pinnedAffinity: { connectionId: string; model: string } | null = null;
  if (strategy === 'cache-optimized' && ctx.prefixHashInput.length > 0) {
    const prefixHash = await sha256Hex(ctx.prefixHashInput.slice(0, 2048));
    pinnedAffinity = await kv.get<{ connectionId: string; model: string }>(
      `aff:prefix:${prefixHash}`,
      'json'
    );
  }

  let lkgpRecord: { connectionId: string; provider: string; model: string } | null = null;
  if (strategy === 'lkgp' || comboSlug === 'auto/lkgp') {
    lkgpRecord = await kv.get<{ connectionId: string; provider: string; model: string }>(
      'lkgp:global',
      'json'
    );
  }

  let rrIndex = 0;
  if (strategy === 'round-robin') {
    const rawRr = await kv.get(`rr:combo:${comboSlug}`);
    rrIndex = rawRr ? ( parseInt(rawRr, 10) || 0 ) : 0;
    await kv.put(`rr:combo:${comboSlug}`, String((rrIndex + 1) % Math.max(1, pool.length)), {
      expirationTtl: 3600,
    });
  }

  // Power of Two Choices (`p2c`): if pool >= 2, sample 2 random candidates and rank them first
  let p2cPairIds: Set<string> | null = null;
  if (strategy === 'p2c' && pool.length >= 2) {
    const idxA = Math.floor(Math.random() * pool.length);
    let idxB = Math.floor(Math.random() * (pool.length - 1));
    if (idxB >= idxA) idxB += 1;
    p2cPairIds = new Set([
      `${pool[idxA].connection.id}:${pool[idxA].model}`,
      `${pool[idxB].connection.id}:${pool[idxB].model}`,
    ]);
  }

  const results: ResolvedCandidate[] = pool.map((item, idx) => {
    const conn = item.connection;
    const spec = findModelSpec(item.model);
    const windowRemaining = Math.max(0, conn.windowTokenLimit - conn.tokensUsedWindow);
    const dailyRemaining = Math.max(0, conn.dailyTokenLimit - conn.tokensUsedToday);
    const windowUtilRatio =
      conn.windowTokenLimit > 0 ? conn.tokensUsedWindow / conn.windowTokenLimit : 0;
    const effectiveCost =
      conn.tier === 'free' || conn.tier === 'subscription'
        ? 0
        : spec.inputCostPer1M + spec.outputCostPer1M;

    let score = 100;
    let reason = `Routed via ${strategy}`;

    switch (strategy) {
      case 'priority': {
        score = 10000 - conn.priority * 10 - conn.consecutiveFailures * 100 + spec.reasoningScore;
        reason = `Priority=${conn.priority}, Reasoning=${spec.reasoningScore}`;
        break;
      }
      case 'fill-first': {
        // Drain account #1 until 95% full before spilling over to account #2
        const hasCapacity = windowUtilRatio < 0.95 && dailyRemaining > 1000;
        score = (hasCapacity ? 10000 : 100) - conn.priority * 20 + windowUtilRatio * 500;
        reason = `Fill-First utilization=${(windowUtilRatio * 100).toFixed(1)}%`;
        break;
      }
      case 'round-robin': {
        const isCurrentTurn = idx === rrIndex % pool.length;
        score = isCurrentTurn ? 10000 : 5000 - ((idx - rrIndex + pool.length) % pool.length);
        reason = `Round-Robin slot #${rrIndex % pool.length}`;
        break;
      }
      case 'weighted': {
        const randomFactor = Math.random() * Math.max(1, conn.weight);
        score = randomFactor * 100 - conn.consecutiveFailures * 50;
        reason = `Weighted draw (weight=${conn.weight})`;
        break;
      }
      case 'random': {
        score = Math.random() * 1000;
        reason = 'Uniform random selection';
        break;
      }
      case 'least-used': {
        score = 100000 - conn.tokensUsedWindow / 100 - conn.totalRequests * 5;
        reason = `Least-Used (${conn.tokensUsedWindow.toLocaleString()} window tokens)`;
        break;
      }
      case 'p2c': {
        const key = `${conn.id}:${item.model}`;
        const inSampledPair = p2cPairIds ? p2cPairIds.has(key) : true;
        const loadPenalty =
          conn.consecutiveFailures * 400 + conn.avgLatencyMs * 0.5 + windowUtilRatio * 300;
        score = (inSampledPair ? 10000 : 2000) - loadPenalty + spec.codingScore;
        reason = `Power-of-Two-Choices (latency=${Math.round(conn.avgLatencyMs)}ms, util=${(
          windowUtilRatio * 100
        ).toFixed(0)}%)`;
        break;
      }
      case 'cache-optimized': {
        const isPinned =
          pinnedAffinity &&
          pinnedAffinity.connectionId === conn.id &&
          pinnedAffinity.model === item.model;
        score =
          (isPinned ? 50000 : 5000) +
          (spec.supportsPromptCache ? 2000 : 0) +
          spec.codingScore * 20 -
          conn.avgLatencyMs * 0.2;
        reason = isPinned
          ? `Prompt-Cache Prefix Affinity HIT on ${conn.name}`
          : `Prompt-Cache candidate (codingScore=${spec.codingScore})`;
        break;
      }
      case 'reset-aware':
      case 'reset-window': {
        // Prioritize subscription accounts whose 5h/daily reset window is closest to expiring
        const isSub = conn.tier === 'subscription' || conn.authType.startsWith('oauth');
        const msUntilReset =
          conn.windowResetAt && conn.windowResetAt > now
            ? conn.windowResetAt - now
            : 86_400_000;
        const hoursUntilReset = Math.max(0.1, msUntilReset / 3_600_000);
        const hasQuota = windowRemaining > 2000;
        score =
          (isSub && hasQuota ? 20000 : 2000) +
          Math.round(5000 / hoursUntilReset) -
          conn.priority * 5;
        reason = `Reset-Aware (${hoursUntilReset.toFixed(1)}h until quota reset, ${windowRemaining.toLocaleString()} tokens left)`;
        break;
      }
      case 'cost-optimized': {
        score = 20000 - effectiveCost * 500 + (conn.tier === 'free' ? 5000 : 0) - conn.avgLatencyMs * 0.1;
        reason = `Cost-Optimized ($${effectiveCost.toFixed(2)}/1M tokens, tier=${conn.tier})`;
        break;
      }
      case 'headroom': {
        score = dailyRemaining / 100 + windowRemaining / 50 - conn.consecutiveFailures * 500;
        reason = `Headroom (${dailyRemaining.toLocaleString()} daily / ${windowRemaining.toLocaleString()} window remaining)`;
        break;
      }
      case 'context-relay': {
        score = spec.contextWindow / 1000 + spec.reasoningScore * 10;
        reason = `Context-Relay (${(spec.contextWindow / 1000).toFixed(0)}K context window for ~${ctx.estimatedPromptTokens} token prompt)`;
        break;
      }
      case 'lkgp': {
        const isLkgp =
          lkgpRecord && lkgpRecord.connectionId === conn.id && lkgpRecord.model === item.model;
        score = (isLkgp ? 50000 : 5000) - conn.avgLatencyMs - conn.consecutiveFailures * 500;
        reason = isLkgp ? `LKGP Verified Hit (${conn.name})` : 'LKGP fallback candidate';
        break;
      }
      case 'latency-optimal': {
        score = 20000 - conn.avgLatencyMs * 5 + spec.speedScore * 100;
        reason = `Latency-Optimal (EWMA=${Math.round(conn.avgLatencyMs)}ms, speedScore=${spec.speedScore})`;
        break;
      }
      case 'quota-share': {
        const allowedShare = (ctx.apiKeyQuotaSharePercent ?? 100) / 100;
        const withinShare = windowUtilRatio <= allowedShare;
        score = (withinShare ? 15000 : 1000) + (1 - windowUtilRatio) * 5000 - conn.priority * 10;
        reason = `Quota-Share (${(windowUtilRatio * 100).toFixed(1)}% used vs ${(
          allowedShare * 100
        ).toFixed(0)}% cap)`;
        break;
      }
      case 'thrifty': {
        const isFreeWithHeadroom = conn.tier === 'free' && windowUtilRatio < 0.8;
        const isSubWithHeadroom = conn.tier === 'subscription' && windowUtilRatio < 0.9;
        score =
          (isFreeWithHeadroom ? 25000 : isSubWithHeadroom ? 18000 : 5000) -
          effectiveCost * 300 +
          windowRemaining / 1000;
        reason = `Thrifty (${conn.tier} tier, ${windowRemaining.toLocaleString()} window headroom)`;
        break;
      }
      case 'fusion': {
        score = spec.reasoningScore * 100 + spec.codingScore * 50 - conn.priority * 10;
        reason = `Fusion ensemble member (${item.model})`;
        break;
      }
      case 'pipeline': {
        score = 10000 - idx * 100;
        reason = `Pipeline stage #${idx + 1} (${item.model})`;
        break;
      }
    }

    return {
      connection: conn,
      model: item.model,
      provider: item.provider,
      strategyUsed: strategy,
      score,
      reason,
    };
  });

  if (strategy !== 'pipeline') {
    results.sort((a, b) => b.score - a.score);
  }
  return results;
}
