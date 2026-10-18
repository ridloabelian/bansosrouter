import { z } from 'zod';

/**
 * Cloudflare Worker Web-Standard Bindings (workerd compatible without DOM clash)
 */
export interface D1Meta {
  duration: number;
  size_after?: number;
  rows_read?: number;
  rows_written?: number;
  last_row_id: number;
  changed_db: boolean;
  changes: number;
}

export interface D1Result<T = unknown> {
  results: T[];
  success: true;
  meta: D1Meta;
  error?: never;
}

export interface D1ExecResult {
  count: number;
  duration: number;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName: string): Promise<T | null>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  raw<T = unknown[]>(options: { columnNames: true }): Promise<[string[], ...T[]]>;
  raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}

export interface KVPutOptions {
  expiration?: number;
  expirationTtl?: number;
  metadata?: Record<string, unknown> | null;
}

export interface KVListResultKey<Metadata = unknown> {
  name: string;
  expiration?: number;
  metadata?: Metadata;
}

export interface KVListResult<Metadata = unknown> {
  keys: KVListResultKey<Metadata>[];
  list_complete: boolean;
  cursor?: string;
}

export interface KVNamespace {
  get(key: string, options?: { type?: 'text'; cacheTtl?: number }): Promise<string | null>;
  get<ExpectedValue = unknown>(key: string, type: 'json'): Promise<ExpectedValue | null>;
  get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>;
  put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: KVPutOptions
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list<Metadata = unknown>(options?: {
    prefix?: string;
    limit?: number;
    cursor?: string;
  }): Promise<KVListResult<Metadata>>;
}

export interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface WorkersAiBinding {
  run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
}

export interface ScheduledController {
  scheduledTime: number;
  cron: string;
  noRetry(): void;
}

export interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
  props: unknown;
}

export interface FlareRouteEnv {
  DB: D1Database;
  FLAREROUTE_KV: KVNamespace;
  ASSETS?: Fetcher;
  AI?: WorkersAiBinding;
  ENCRYPTION_SECRET: string;
  ADMIN_PASSWORD: string;
  FLAREROUTE_VERSION?: string;
  DEFAULT_ROUTING_STRATEGY?: string;
  DEFAULT_COMPRESSION_PROFILE?: string;
}

/**
 * 19 Routing Strategies (9router + OmniRoute combined)
 */
export const ROUTING_STRATEGIES = [
  'priority',
  'fill-first',
  'round-robin',
  'weighted',
  'random',
  'least-used',
  'p2c',
  'cache-optimized',
  'reset-aware',
  'reset-window',
  'cost-optimized',
  'headroom',
  'context-relay',
  'lkgp',
  'latency-optimal',
  'quota-share',
  'thrifty',
  'fusion',
  'pipeline',
] as const;

export type RoutingStrategy = (typeof ROUTING_STRATEGIES)[number];

/**
 * Bansos & Auto Virtual Combo Presets (100% Rp 0 / $0 Lock)
 */
export const VIRTUAL_AUTO_COMBOS = [
  'bansos/auto',
  'bansos/no-cc',
  'bansos/coding',
  'bansos/reasoning',
  'bansos/fast',
  'bansos/million-context',
  'bansos/indo',
  'auto',
  'auto/coding',
  'auto/fast',
  'auto/cheap',
  'auto/subscription',
  'auto/thrifty',
  'auto/smart',
  'auto/lkgp',
] as const;

export type VirtualAutoCombo = (typeof VIRTUAL_AUTO_COMBOS)[number];

/**
 * 10 Pure-TypeScript Token Compression Layers
 */
export const COMPRESSION_LAYERS = [
  'session-dedup',
  'ccr',
  'lite',
  'rtk',
  'responses-tool',
  'headroom',
  'relevance',
  'caveman',
  'aggressive',
  'ultra',
] as const;

export type CompressionLayer = (typeof COMPRESSION_LAYERS)[number];

export const COMPRESSION_PROFILES = [
  'off',
  'lite',
  'balanced',
  'aggressive',
  'ultra',
  'custom',
] as const;

export type CompressionProfile = (typeof COMPRESSION_PROFILES)[number];

/**
 * Decrypted Provider Credentials stored inside `encrypted_credentials` column
 */
export const DecryptedCredentialsSchema = z.object({
  apiKey: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  tokenEndpoint: z.string().optional(),
  projectId: z.string().optional(),
  region: z.string().optional(),
  serviceAccountEmail: z.string().optional(),
  privateKeyPem: z.string().optional(),
  copilotToken: z.string().optional(),
  copilotExpiresAt: z.number().optional(),
  extraHeaders: z.record(z.string()).optional(),
});

export type DecryptedCredentials = z.infer<typeof DecryptedCredentialsSchema>;

/**
 * Combo Candidate Schema
 */
export const ComboCandidateSchema = z.object({
  connectionId: z.string().optional(),
  provider: z.string(),
  model: z.string(),
  weight: z.number().default(100),
  priority: z.number().default(100),
  maxContext: z.number().default(128000),
  stagePrompt: z.string().optional(), // For 'pipeline' strategy
});

export type ComboCandidate = z.infer<typeof ComboCandidateSchema>;
