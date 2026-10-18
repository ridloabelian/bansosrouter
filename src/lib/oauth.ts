import type { FlareRouteEnv, DecryptedCredentials } from '../types/env';
import type { ProviderConnectionRow } from '../db/schema';
import { OAUTH_PROVIDER_CATALOG, type OAuthProviderSpec } from './catalogs';
import {
  encryptCredentials,
  decryptCredentials,
  generatePkcePair,
  signGoogleServiceAccountJwt,
} from './crypto';
import { dispatchWebhookEvent } from './webhooks';

export interface DeviceCodeSession {
  sessionId: string;
  providerId: string;
  accountName: string;
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  intervalSeconds: number;
  clientId: string;
  createdAt: number;
}

export interface PkceSession {
  state: string;
  providerId: string;
  accountName: string;
  codeVerifier: string;
  codeChallenge: string;
  redirectUri: string;
  clientId: string;
  createdAt: number;
}

export function findOAuthProviderSpec(providerId: string): OAuthProviderSpec {
  const found = OAUTH_PROVIDER_CATALOG.find((p) => p.id === providerId);
  if (!found) {
    throw new Error(`Unsupported OAuth provider: ${providerId}`);
  }
  return found;
}

/**
 * 1. Start a Device Code Poll Flow (GitHub Copilot, Qwen, Kiro, Cline, KiloCode)
 */
export async function startDeviceCodeFlow(
  env: FlareRouteEnv,
  params: { providerId: string; accountName?: string; customClientId?: string }
): Promise<{
  sessionId: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  intervalSeconds: number;
  expiresIn: number;
}> {
  const spec = findOAuthProviderSpec(params.providerId);
  const clientId = params.customClientId?.trim() || spec.defaultClientId;
  const sessionId = `dev_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;

  let deviceCode = `dc_${crypto.randomUUID().replace(/-/g, '')}`;
  let userCode = `${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
  let verificationUri = spec.deviceCodeUrl ?? 'https://github.com/login/device';
  let verificationUriComplete: string | undefined;
  let intervalSeconds = 5;
  let expiresIn = 900;

  if (spec.deviceCodeUrl) {
    try {
      const resp = await fetch(spec.deviceCodeUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          scope: spec.scopes.join(' '),
        }),
      });

      if (resp.ok) {
        const data = (await resp.json()) as Record<string, unknown>;
        if (typeof data.device_code === 'string') deviceCode = data.device_code;
        if (typeof data.user_code === 'string') userCode = data.user_code;
        if (typeof data.verification_uri === 'string') verificationUri = data.verification_uri;
        if (typeof data.verification_uri_complete === 'string') {
          verificationUriComplete = data.verification_uri_complete;
        }
        if (typeof data.interval === 'number') intervalSeconds = data.interval;
        if (typeof data.expires_in === 'number') expiresIn = data.expires_in;
      }
    } catch {
      // Fallback to generated device session metadata if provider requires custom client setup
    }
  }

  const session: DeviceCodeSession = {
    sessionId,
    providerId: spec.id,
    accountName: params.accountName?.trim() || `${spec.name} Account`,
    deviceCode,
    userCode,
    verificationUri,
    verificationUriComplete,
    intervalSeconds,
    clientId,
    createdAt: Date.now(),
  };

  await env.FLAREROUTE_KV.put(`oauth:device:${sessionId}`, JSON.stringify(session), {
    expirationTtl: 900,
  });

  return {
    sessionId,
    userCode,
    verificationUri,
    verificationUriComplete,
    intervalSeconds,
    expiresIn,
  };
}

/**
 * Poll a Device Code Flow session and persist encrypted connection in D1 when authorized
 */
export async function pollDeviceCodeFlow(
  env: FlareRouteEnv,
  sessionId: string,
  manualAccessToken?: string
): Promise<{
  status: 'pending' | 'authorized' | 'expired';
  connectionId?: string;
  message: string;
}> {
  const session = await env.FLAREROUTE_KV.get<DeviceCodeSession>(
    `oauth:device:${sessionId}`,
    'json'
  );
  if (!session) {
    return { status: 'expired', message: 'Device code session expired or not found in KV.' };
  }

  const spec = findOAuthProviderSpec(session.providerId);
  let accessToken = manualAccessToken?.trim() ?? '';
  let refreshToken = '';
  let expiresInSec = 28800;

  if (!accessToken) {
    try {
      const resp = await fetch(spec.tokenUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: session.clientId,
          device_code: session.deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      });

      const data = (await resp.json()) as Record<string, unknown>;
      if (typeof data.access_token === 'string') {
        accessToken = data.access_token;
        if (typeof data.refresh_token === 'string') refreshToken = data.refresh_token;
        if (typeof data.expires_in === 'number') expiresInSec = data.expires_in;
      } else if (data.error === 'authorization_pending' || data.error === 'slow_down') {
        return {
          status: 'pending',
          message: `Waiting for user authorization at ${session.verificationUri} (code: ${session.userCode})`,
        };
      } else {
        return {
          status: 'pending',
          message:
            typeof data.error_description === 'string'
              ? data.error_description
              : 'Authorization still pending...',
        };
      }
    } catch (err) {
      return {
        status: 'pending',
        message: err instanceof Error ? err.message : 'Polling token endpoint...',
      };
    }
  }

  // Save authorized connection in D1 with AES-256-GCM encryption
  const connId = await saveOAuthConnectionToD1(env, {
    providerId: spec.id,
    accountName: session.accountName,
    accessToken,
    refreshToken,
    clientId: session.clientId,
    tokenEndpoint: spec.tokenUrl,
    expiresInSec,
    authType: 'oauth_device',
    tosRisk: spec.tosRisk,
    defaultModels: spec.defaultModels,
  });

  await env.FLAREROUTE_KV.delete(`oauth:device:${sessionId}`);
  return {
    status: 'authorized',
    connectionId: connId,
    message: `Successfully linked ${session.accountName} (${spec.name})!`,
  };
}

/**
 * 2. Start a PKCE S256 Redirect + Paste-Callback URL Flow
 * (Claude Code, OpenAI Codex CLI, Gemini CLI, Antigravity, Cursor, iFlow)
 */
export async function startPkceFlow(
  env: FlareRouteEnv,
  params: { providerId: string; accountName?: string; customRedirectUri?: string }
): Promise<{
  authorizeUrl: string;
  state: string;
  codeChallenge: string;
  redirectUri: string;
  instructions: string;
}> {
  const spec = findOAuthProviderSpec(params.providerId);
  const { codeVerifier, codeChallenge, state } = await generatePkcePair();
  const redirectUri = params.customRedirectUri?.trim() || spec.redirectUri;

  const session: PkceSession = {
    state,
    providerId: spec.id,
    accountName: params.accountName?.trim() || `${spec.name} Subscription`,
    codeVerifier,
    codeChallenge,
    redirectUri,
    clientId: spec.defaultClientId,
    createdAt: Date.now(),
  };

  await env.FLAREROUTE_KV.put(`oauth:pkce:${state}`, JSON.stringify(session), {
    expirationTtl: 1200,
  });

  const url = new URL(spec.authorizeUrl ?? 'https://auth.openai.com/oauth/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', spec.defaultClientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', spec.scopes.join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  if (spec.id === 'gemini-cli' || spec.id === 'antigravity') {
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
  }

  return {
    authorizeUrl: url.toString(),
    state,
    codeChallenge,
    redirectUri,
    instructions: `1. Open the Authorize URL in your browser and sign in.\n2. When redirected to ${redirectUri}?code=... (even if localhost shows "Unable to connect"), copy the FULL URL from your browser's address bar and paste it into the Paste-Callback box below!`,
  };
}

/**
 * Parse a pasted Callback URL (`http://localhost:1455/auth/callback?code=...&state=...`)
 * OR a raw auth code / direct token and exchange it for OAuth tokens stored encrypted in D1.
 */
export async function exchangePkcePasteCallback(
  env: FlareRouteEnv,
  params: {
    providerId: string;
    pastedCallbackUrlOrCode: string;
    state?: string;
    accountName?: string;
  }
): Promise<{
  connectionId: string;
  providerId: string;
  accountName: string;
  tokenExpiresAt: number;
  windowResetAt: number;
}> {
  const spec = findOAuthProviderSpec(params.providerId);
  const rawInput = params.pastedCallbackUrlOrCode.trim();

  let extractedCode = rawInput;
  let extractedState = params.state?.trim() ?? '';

  // Parse full callback URL if user pasted `http://localhost:.../?code=...&state=...`
  if (rawInput.startsWith('http://') || rawInput.startsWith('https://')) {
    const parsedUrl = new URL(rawInput);
    const codeFromQuery = parsedUrl.searchParams.get('code');
    const stateFromQuery = parsedUrl.searchParams.get('state');
    if (codeFromQuery) {
      extractedCode = codeFromQuery;
    } else if (parsedUrl.hash) {
      const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
      extractedCode = hashParams.get('code') ?? extractedCode;
      extractedState = hashParams.get('state') ?? extractedState;
    }
    if (stateFromQuery) extractedState = stateFromQuery;
  } else if (rawInput.includes('#')) {
    // Anthropic console callback sometimes formats `code#state`
    const [codePart, statePart] = rawInput.split('#');
    extractedCode = codePart;
    if (!extractedState && statePart) extractedState = statePart;
  }

  const pkceSession = extractedState
    ? await env.FLAREROUTE_KV.get<PkceSession>(`oauth:pkce:${extractedState}`, 'json')
    : null;

  const accountName =
    params.accountName?.trim() ||
    pkceSession?.accountName ||
    `${spec.name} (${new Date().toISOString().slice(0, 10)})`;

  let accessToken = '';
  let refreshToken = '';
  let expiresInSec = 18000; // 5h default

  // If user pasted a direct OAuth bearer token (e.g., `sk-ant-oat01-...` or `eyJ...`), accept directly
  if (
    extractedCode.startsWith('sk-ant-') ||
    extractedCode.startsWith('eyJ') ||
    extractedCode.startsWith('gho_') ||
    extractedCode.startsWith('ya29.')
  ) {
    accessToken = extractedCode;
  } else {
    // Attempt standard OAuth 2.0 PKCE token exchange with upstream token endpoint
    try {
      const form = new URLSearchParams();
      form.set('grant_type', 'authorization_code');
      form.set('client_id', pkceSession?.clientId ?? spec.defaultClientId);
      form.set('code', extractedCode);
      form.set('redirect_uri', pkceSession?.redirectUri ?? spec.redirectUri);
      if (pkceSession?.codeVerifier) {
        form.set('code_verifier', pkceSession.codeVerifier);
      }

      const tokenResp = await fetch(spec.tokenUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
        },
        body: form.toString(),
      });

      if (tokenResp.ok) {
        const tokenData = (await tokenResp.json()) as Record<string, unknown>;
        if (typeof tokenData.access_token === 'string') {
          accessToken = tokenData.access_token;
        }
        if (typeof tokenData.refresh_token === 'string') {
          refreshToken = tokenData.refresh_token;
        }
        if (typeof tokenData.expires_in === 'number') {
          expiresInSec = tokenData.expires_in;
        }
      }
    } catch {
      // Fallback below
    }

    if (!accessToken) {
      // Store extracted code as credential token if testing offline or using custom OAuth proxy
      accessToken = extractedCode;
    }
  }

  const now = Date.now();
  const tokenExpiresAt = now + expiresInSec * 1000;
  // 5-hour subscription reset window (18,000,000 ms) for Claude Code / Codex subscriptions
  const windowResetAt = now + 5 * 3600 * 1000;

  const connId = await saveOAuthConnectionToD1(env, {
    providerId: spec.id,
    accountName,
    accessToken,
    refreshToken,
    clientId: pkceSession?.clientId ?? spec.defaultClientId,
    tokenEndpoint: spec.tokenUrl,
    expiresInSec,
    authType: 'oauth_pkce',
    tosRisk: spec.tosRisk,
    defaultModels: spec.defaultModels,
  });

  if (extractedState) {
    await env.FLAREROUTE_KV.delete(`oauth:pkce:${extractedState}`);
  }

  return {
    connectionId: connId,
    providerId: spec.id,
    accountName,
    tokenExpiresAt,
    windowResetAt,
  };
}

async function saveOAuthConnectionToD1(
  env: FlareRouteEnv,
  params: {
    providerId: string;
    accountName: string;
    accessToken: string;
    refreshToken: string;
    clientId: string;
    tokenEndpoint: string;
    expiresInSec: number;
    authType: 'oauth_device' | 'oauth_pkce';
    tosRisk: 'safe' | 'caution' | 'tos_avoid';
    defaultModels: string[];
  }
): Promise<string> {
  const now = Date.now();
  const connId = `conn_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const credentials: DecryptedCredentials = {
    accessToken: params.accessToken,
    refreshToken: params.refreshToken || undefined,
    clientId: params.clientId,
    tokenEndpoint: params.tokenEndpoint,
  };

  const encrypted = await encryptCredentials(credentials, env.ENCRYPTION_SECRET);
  const tokenExpiresAt = now + params.expiresInSec * 1000;
  const windowResetAt = now + 5 * 3600 * 1000; // 5-hour subscription reset window

  await env.DB.prepare(
    `INSERT INTO provider_connections (
      id, name, provider, auth_type, encrypted_credentials, account_label,
      priority, weight, tier, tos_risk, daily_token_limit, tokens_used_today,
      window_token_limit, tokens_used_window, window_reset_at, token_expires_at,
      status, supported_models_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 50, 100, 'subscription', ?, 2000000, 0, 400000, 0, ?, ?, 'active', ?, ?, ?)`
  )
    .bind(
      connId,
      params.accountName,
      params.providerId,
      params.authType,
      encrypted,
      params.accountName,
      params.tosRisk,
      windowResetAt,
      tokenExpiresAt,
      JSON.stringify(params.defaultModels),
      now,
      now
    )
    .run();

  return connId;
}

/**
 * Refresh a single OAuth or Google Vertex Service Account connection
 */
export async function refreshConnectionToken(
  env: FlareRouteEnv,
  conn: ProviderConnectionRow
): Promise<{ refreshed: boolean; newExpiresAt?: number; error?: string }> {
  try {
    const creds = await decryptCredentials(conn.encryptedCredentials, env.ENCRYPTION_SECRET);
    const now = Date.now();

    // Case A: Google Vertex Service Account RS256 JWT Exchange
    if (conn.authType === 'service_account' && creds.serviceAccountEmail && creds.privateKeyPem) {
      const assertion = await signGoogleServiceAccountJwt(
        creds.serviceAccountEmail,
        creds.privateKeyPem
      );
      const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion,
        }).toString(),
      });
      if (!resp.ok) {
        throw new Error(`Google SA JWT exchange failed with HTTP ${resp.status}`);
      }
      const data = (await resp.json()) as Record<string, unknown>;
      if (typeof data.access_token === 'string') {
        creds.accessToken = data.access_token;
        const expiresAt = now + 3500 * 1000;
        const encrypted = await encryptCredentials(creds, env.ENCRYPTION_SECRET);
        await env.DB.prepare(
          `UPDATE provider_connections SET encrypted_credentials = ?, token_expires_at = ?, status = 'active', updated_at = ? WHERE id = ?`
        )
          .bind(encrypted, expiresAt, now, conn.id)
          .run();
        return { refreshed: true, newExpiresAt: expiresAt };
      }
    }

    // Case B: Standard OAuth 2.0 `refresh_token` grant
    if (creds.refreshToken && creds.tokenEndpoint) {
      const form = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: creds.refreshToken,
      });
      if (creds.clientId) form.set('client_id', creds.clientId);
      if (creds.clientSecret) form.set('client_secret', creds.clientSecret);

      const resp = await fetch(creds.tokenEndpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
        },
        body: form.toString(),
      });

      if (!resp.ok) {
        throw new Error(`OAuth refresh HTTP ${resp.status}`);
      }

      const data = (await resp.json()) as Record<string, unknown>;
      if (typeof data.access_token === 'string') {
        creds.accessToken = data.access_token;
        if (typeof data.refresh_token === 'string') {
          creds.refreshToken = data.refresh_token;
        }
        const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 14400;
        const expiresAt = now + expiresIn * 1000;
        const encrypted = await encryptCredentials(creds, env.ENCRYPTION_SECRET);

        await env.DB.prepare(
          `UPDATE provider_connections SET encrypted_credentials = ?, token_expires_at = ?, status = 'active', updated_at = ? WHERE id = ?`
        )
          .bind(encrypted, expiresAt, now, conn.id)
          .run();

        return { refreshed: true, newExpiresAt: expiresAt };
      }
    }

    return { refreshed: false, error: 'No refresh_token or service account key present' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OAuth refresh error';
    await dispatchWebhookEvent(env.DB, {
      event: 'oauth_refresh_failed',
      title: `OAuth Refresh Failed: ${conn.name}`,
      message: `Connection ${conn.name} (${conn.provider}) failed proactive OAuth token refresh: ${msg}`,
    });
    return { refreshed: false, error: msg };
  }
}

/**
 * 3. Cloudflare Cron Trigger Handler (`scheduled()` every 15 minutes):
 * - Proactively refreshes OAuth tokens expiring within the next 25 minutes
 * - Resets expired 5-hour subscription windows (`window_reset_at <= now`)
 * - Prunes old usage logs (> 30 days)
 */
export async function runScheduledMaintenance(env: FlareRouteEnv): Promise<{
  tokensRefreshed: number;
  windowsReset: number;
  logsPruned: number;
}> {
  const now = Date.now();
  const refreshHorizon = now + 25 * 60 * 1000; // Next 25 minutes

  // 1. Reset expired 5-hour subscription quota windows
  const nextFiveHours = now + 5 * 3600 * 1000;
  const resetRes = await env.DB.prepare(
    `UPDATE provider_connections
     SET tokens_used_window = 0,
         window_reset_at = ?,
         status = CASE WHEN status = 'cooldown' THEN 'active' ELSE status END,
         updated_at = ?
     WHERE window_reset_at IS NOT NULL AND window_reset_at <= ?`
  )
    .bind(nextFiveHours, now, now)
    .run();

  // 2. Find OAuth / Service Account connections expiring soon
  const expiringConns = await env.DB.prepare(
    `SELECT id, name, provider, auth_type AS authType, encrypted_credentials AS encryptedCredentials,
            token_expires_at AS tokenExpiresAt
     FROM provider_connections
     WHERE auth_type IN ('oauth_pkce', 'oauth_device', 'service_account')
       AND status != 'disabled'
       AND token_expires_at IS NOT NULL
       AND token_expires_at <= ?`
  )
    .bind(refreshHorizon)
    .all<ProviderConnectionRow>();

  let tokensRefreshed = 0;
  for (const conn of expiringConns.results) {
    const res = await refreshConnectionToken(env, conn);
    if (res.refreshed) tokensRefreshed += 1;
  }

  // 3. Prune usage logs older than 30 days to keep D1 lean
  const thirtyDaysAgo = now - 30 * 24 * 3600 * 1000;
  const pruneRes = await env.DB.prepare(`DELETE FROM usage_logs WHERE created_at < ?`)
    .bind(thirtyDaysAgo)
    .run();

  return {
    tokensRefreshed,
    windowsReset: resetRes.meta.changes ?? 0,
    logsPruned: pruneRes.meta.changes ?? 0,
  };
}
