import type { KVNamespace, D1Database } from '../types/env';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF-OPEN';

export interface ProviderCircuitRecord {
  provider: string;
  state: CircuitState;
  failures: number;
  openedAt: number | null;
  openUntil: number | null;
  lastError: string | null;
}

export interface ConnectionCooldownRecord {
  connectionId: string;
  untilMs: number;
  attempt: number;
  reason: string;
}

export interface ModelLockoutRecord {
  connectionId: string;
  model: string;
  untilMs: number;
  statusCode: number;
  reason: string;
}

export interface CandidateHealthStatus {
  healthy: boolean;
  circuitState: CircuitState;
  inCooldown: boolean;
  modelLocked: boolean;
  blockedReason?: string;
}

const CIRCUIT_FAILURE_THRESHOLD = 4;
const CIRCUIT_OPEN_MS = 60_000;
const BASE_BACKOFF_MS = 2_000;
const MAX_BACKOFF_MS = 120_000;
const JITTER_MAX_MS = 1_500;

function circuitKey(provider: string): string {
  return `cb:provider:${provider}`;
}

function cooldownKey(connectionId: string): string {
  return `cd:conn:${connectionId}`;
}

function modelLockKey(connectionId: string, model: string): string {
  return `lock:conn:${connectionId}:model:${model}`;
}

/**
 * Parse HTTP `Retry-After` header (supports delta-seconds or HTTP-date)
 */
export function parseRetryAfterMs(retryAfterHeader: string | null | undefined): number | null {
  if (!retryAfterHeader) return null;
  const trimmed = retryAfterHeader.trim();
  const seconds = Number(trimmed);
  if (!Number.isNaN(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, 3_600_000);
  }
  const parsedDate = Date.parse(trimmed);
  if (!Number.isNaN(parsedDate)) {
    const delta = parsedDate - Date.now();
    return delta > 0 ? Math.min(delta, 3_600_000) : null;
  }
  return null;
}

/**
 * Calculate Exponential Backoff + Random Jitter (prevents thundering herd)
 */
export function computeExponentialBackoffWithJitter(
  attempt: number,
  retryAfterMs?: number | null
): number {
  if (retryAfterMs && retryAfterMs > 0) {
    const smallJitter = Math.floor(Math.random() * 500);
    return retryAfterMs + smallJitter;
  }
  const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, Math.max(0, attempt - 1)));
  const randomJitter = Math.floor(Math.random() * JITTER_MAX_MS);
  return exp + randomJitter;
}

/**
 * Layer 1: Check Provider Circuit Breaker State (CLOSED / OPEN / HALF-OPEN)
 */
export async function getProviderCircuitState(
  kv: KVNamespace,
  provider: string
): Promise<ProviderCircuitRecord> {
  const record = await kv.get<ProviderCircuitRecord>(circuitKey(provider), 'json');
  if (!record) {
    return {
      provider,
      state: 'CLOSED',
      failures: 0,
      openedAt: null,
      openUntil: null,
      lastError: null,
    };
  }

  const now = Date.now();
  if (record.state === 'OPEN' && record.openUntil && now >= record.openUntil) {
    return {
      ...record,
      state: 'HALF-OPEN',
    };
  }
  return record;
}

/**
 * Check all 3 Resilience Layers for a candidate `(provider, connectionId, model)`:
 * - Layer 1: Provider Circuit Breaker
 * - Layer 2: Connection Cooldown + Jitter
 * - Layer 3: Per-Model Lockout `(connectionId, model)`
 */
export async function checkCandidateResilience(
  kv: KVNamespace,
  provider: string,
  connectionId: string,
  model: string
): Promise<CandidateHealthStatus> {
  const now = Date.now();
  const [circuit, cooldown, modelLock] = await Promise.all([
    getProviderCircuitState(kv, provider),
    kv.get<ConnectionCooldownRecord>(cooldownKey(connectionId), 'json'),
    kv.get<ModelLockoutRecord>(modelLockKey(connectionId, model), 'json'),
  ]);

  if (circuit.state === 'OPEN') {
    return {
      healthy: false,
      circuitState: 'OPEN',
      inCooldown: false,
      modelLocked: false,
      blockedReason: `Layer 1 Circuit OPEN for provider '${provider}' until ${new Date(
        circuit.openUntil ?? now
      ).toISOString()}`,
    };
  }

  if (cooldown && cooldown.untilMs > now) {
    return {
      healthy: false,
      circuitState: circuit.state,
      inCooldown: true,
      modelLocked: false,
      blockedReason: `Layer 2 Connection '${connectionId}' in cooldown (${cooldown.reason}) for ${Math.ceil(
        (cooldown.untilMs - now) / 1000
      )}s`,
    };
  }

  if (modelLock && modelLock.untilMs > now) {
    return {
      healthy: false,
      circuitState: circuit.state,
      inCooldown: false,
      modelLocked: true,
      blockedReason: `Layer 3 Per-Model Lockout on (${connectionId}, ${model}) for ${Math.ceil(
        (modelLock.untilMs - now) / 1000
      )}s`,
    };
  }

  return {
    healthy: true,
    circuitState: circuit.state,
    inCooldown: false,
    modelLocked: false,
  };
}

/**
 * Record a successful upstream execution:
 * - Closes HALF-OPEN / resets failure counter on Layer 1
 * - Clears Layer 2 cooldown
 * - Updates EWMA latency & lastknown good provider (LKGP) in KV and D1
 */
export async function recordCandidateSuccess(
  kv: KVNamespace,
  d1: D1Database,
  params: {
    provider: string;
    connectionId: string;
    model: string;
    latencyMs: number;
    tokensUsed: number;
    costUsd: number;
  }
): Promise<void> {
  const now = Date.now();
  await Promise.all([
    kv.delete(circuitKey(params.provider)),
    kv.delete(cooldownKey(params.connectionId)),
    kv.put(
      'lkgp:global',
      JSON.stringify({
        connectionId: params.connectionId,
        provider: params.provider,
        model: params.model,
        latencyMs: params.latencyMs,
        verifiedAt: now,
      }),
      { expirationTtl: 3600 }
    ),
    d1
      .prepare(
        `UPDATE provider_connections
         SET status = 'active',
             consecutive_failures = 0,
             avg_latency_ms = ROUND((avg_latency_ms * 0.7) + (? * 0.3), 1),
             total_requests = total_requests + 1,
             total_tokens = total_tokens + ?,
             tokens_used_today = tokens_used_today + ?,
             tokens_used_window = tokens_used_window + ?,
             total_cost_usd = ROUND(total_cost_usd + ?, 6),
             last_used_at = ?,
             updated_at = ?
         WHERE id = ?`
      )
      .bind(
        params.latencyMs,
        params.tokensUsed,
        params.tokensUsed,
        params.tokensUsed,
        params.costUsd,
        now,
        now,
        params.connectionId
      )
      .run(),
  ]);
}

/**
 * Record an upstream failure across the 3-Layer Resilience Engine:
 * - HTTP 429 / 404 on a specific model -> triggers Layer 3 Per-Model Lockout `(connectionId, model)`
 *   so other models on the same connection keep working!
 * - Account-wide 429 or Retry-After -> triggers Layer 2 Connection Cooldown + Jitter.
 * - HTTP 5xx or timeout -> increments Layer 1 Provider Circuit Breaker towards OPEN.
 */
export async function recordCandidateFailure(
  kv: KVNamespace,
  d1: D1Database,
  params: {
    provider: string;
    connectionId: string;
    model: string;
    statusCode: number;
    errorMessage: string;
    retryAfterHeader?: string | null;
    isModelSpecificError?: boolean;
  }
): Promise<{
  circuitOpened: boolean;
  modelLocked: boolean;
  cooldownAppliedMs: number;
}> {
  const now = Date.now();
  const retryAfterMs = parseRetryAfterMs(params.retryAfterHeader);
  let circuitOpened = false;
  let modelLocked = false;
  let cooldownAppliedMs = 0;

  // Layer 3: Per-Model Lockout (404 Model Not Found, or 429 on a specific model without locking other models)
  const isModelScoped =
    params.isModelSpecificError === true ||
    params.statusCode === 404 ||
    (params.statusCode === 429 &&
      (params.errorMessage.toLowerCase().includes('model') ||
        params.errorMessage.toLowerCase().includes('opus') ||
        params.errorMessage.toLowerCase().includes('tier') ||
        params.errorMessage.toLowerCase().includes('quota for model')));

  if (isModelScoped || params.statusCode === 429) {
    // Always lock the specific (connectionId, model) pair on 429/404 so sibling models remain usable
    const lockDurationMs =
      params.statusCode === 404 ? 600_000 : retryAfterMs ?? 90_000 + Math.floor(Math.random() * 5_000);
    const ttlSeconds = Math.max(60, Math.ceil(lockDurationMs / 1000));
    const lockRecord: ModelLockoutRecord = {
      connectionId: params.connectionId,
      model: params.model,
      untilMs: now + lockDurationMs,
      statusCode: params.statusCode,
      reason: params.errorMessage.slice(0, 180),
    };
    await kv.put(modelLockKey(params.connectionId, params.model), JSON.stringify(lockRecord), {
      expirationTtl: ttlSeconds,
    });
    modelLocked = true;
  }

  // Layer 2: Connection Cooldown + Jitter (only if not purely a single-model 404/model-quota error)
  if (!isModelScoped && (params.statusCode === 429 || params.statusCode >= 500)) {
    const existingCd = await kv.get<ConnectionCooldownRecord>(
      cooldownKey(params.connectionId),
      'json'
    );
    const attempt = (existingCd?.attempt ?? 0) + 1;
    cooldownAppliedMs = computeExponentialBackoffWithJitter(attempt, retryAfterMs);
    const ttlSeconds = Math.max(60, Math.ceil(cooldownAppliedMs / 1000));
    const cdRecord: ConnectionCooldownRecord = {
      connectionId: params.connectionId,
      untilMs: now + cooldownAppliedMs,
      attempt,
      reason: `HTTP ${params.statusCode}: ${params.errorMessage.slice(0, 140)}`,
    };
    await kv.put(cooldownKey(params.connectionId), JSON.stringify(cdRecord), {
      expirationTtl: ttlSeconds,
    });
  }

  // Layer 1: Provider Circuit Breaker (on 5xx or network timeout)
  if (params.statusCode >= 500 || params.statusCode === 0) {
    const currentCircuit = await getProviderCircuitState(kv, params.provider);
    const nextFailures = currentCircuit.failures + 1;
    const shouldOpen =
      currentCircuit.state === 'HALF-OPEN' || nextFailures >= CIRCUIT_FAILURE_THRESHOLD;
    const openDuration = currentCircuit.state === 'HALF-OPEN' ? CIRCUIT_OPEN_MS * 2 : CIRCUIT_OPEN_MS;

    const updatedCircuit: ProviderCircuitRecord = {
      provider: params.provider,
      state: shouldOpen ? 'OPEN' : 'CLOSED',
      failures: nextFailures,
      openedAt: shouldOpen ? now : currentCircuit.openedAt,
      openUntil: shouldOpen ? now + openDuration : null,
      lastError: params.errorMessage.slice(0, 200),
    };

    await kv.put(circuitKey(params.provider), JSON.stringify(updatedCircuit), {
      expirationTtl: 300,
    });
    circuitOpened = shouldOpen;
  }

  await d1
    .prepare(
      `UPDATE provider_connections
       SET consecutive_failures = consecutive_failures + 1,
           status = CASE WHEN ? = 1 THEN 'circuit_open' WHEN ? > 0 THEN 'cooldown' ELSE status END,
           last_error = ?,
           updated_at = ?
       WHERE id = ?`
    )
    .bind(
      circuitOpened ? 1 : 0,
      cooldownAppliedMs,
      `[${params.statusCode}] ${params.errorMessage.slice(0, 240)}`,
      now,
      params.connectionId
    )
    .run();

  return { circuitOpened, modelLocked, cooldownAppliedMs };
}

/**
 * List active KV resilience states (Circuit Breakers, Cooldowns, Per-Model Lockouts) for the Dashboard & MCP
 */
export async function listActiveResilienceStates(kv: KVNamespace): Promise<{
  circuits: ProviderCircuitRecord[];
  cooldowns: ConnectionCooldownRecord[];
  modelLockouts: ModelLockoutRecord[];
}> {
  const [cbList, cdList, lockList] = await Promise.all([
    kv.list({ prefix: 'cb:provider:' }),
    kv.list({ prefix: 'cd:conn:' }),
    kv.list({ prefix: 'lock:conn:' }),
  ]);

  const now = Date.now();
  const circuits: ProviderCircuitRecord[] = [];
  const cooldowns: ConnectionCooldownRecord[] = [];
  const modelLockouts: ModelLockoutRecord[] = [];

  for (const key of cbList.keys) {
    const item = await kv.get<ProviderCircuitRecord>(key.name, 'json');
    if (item) circuits.push(item);
  }
  for (const key of cdList.keys) {
    const item = await kv.get<ConnectionCooldownRecord>(key.name, 'json');
    if (item && item.untilMs > now) cooldowns.push(item);
  }
  for (const key of lockList.keys) {
    const item = await kv.get<ModelLockoutRecord>(key.name, 'json');
    if (item && item.untilMs > now) modelLockouts.push(item);
  }

  return { circuits, cooldowns, modelLockouts };
}
