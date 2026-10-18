import { Hono } from 'hono';
import { z } from 'zod';
import type { FlareRouteEnv } from '../types/env';
import type { ProviderConnectionRow } from '../db/schema';
import { OAUTH_PROVIDER_CATALOG } from '../lib/catalogs';
import {
  startDeviceCodeFlow,
  pollDeviceCodeFlow,
  startPkceFlow,
  exchangePkcePasteCallback,
  refreshConnectionToken,
} from '../lib/oauth';
import { sha256Hex } from '../lib/crypto';

export const oauthRouter = new Hono<{ Bindings: FlareRouteEnv }>();

oauthRouter.use('*', async (c, next) => {
  const expectedPassword = c.env.ADMIN_PASSWORD;
  if (!expectedPassword) {
    return c.json({ error: 'ADMIN_PASSWORD not configured' }, 500);
  }
  const expectedToken = await sha256Hex(`flareroute-admin:admin:${expectedPassword}`);
  const headerToken =
    c.req.header('x-admin-token') ??
    c.req.header('authorization')?.replace(/^Bearer\s+/i, '');

  if (headerToken && (headerToken === expectedPassword || headerToken === expectedToken)) {
    return next();
  }
  return c.json({ error: 'Unauthorized: Admin session required for OAuth management' }, 401);
});

oauthRouter.get('/providers', (c) => {
  return c.json({
    providers: OAUTH_PROVIDER_CATALOG,
  });
});

const DeviceStartSchema = z.object({
  providerId: z.string().min(1),
  accountName: z.string().optional(),
  customClientId: z.string().optional(),
});

oauthRouter.post('/device/start', async (c) => {
  const raw = (await c.req.json()) as unknown;
  const parsed = DeviceStartSchema.parse(raw);
  const result = await startDeviceCodeFlow(c.env, parsed);
  return c.json(result);
});

const DevicePollSchema = z.object({
  sessionId: z.string().min(1),
  manualAccessToken: z.string().optional(),
});

oauthRouter.post('/device/poll', async (c) => {
  const raw = (await c.req.json()) as unknown;
  const parsed = DevicePollSchema.parse(raw);
  const result = await pollDeviceCodeFlow(
    c.env,
    parsed.sessionId,
    parsed.manualAccessToken
  );
  return c.json(result);
});

const PkceStartSchema = z.object({
  providerId: z.string().min(1),
  accountName: z.string().optional(),
  customRedirectUri: z.string().optional(),
});

oauthRouter.post('/pkce/start', async (c) => {
  const raw = (await c.req.json()) as unknown;
  const parsed = PkceStartSchema.parse(raw);
  const result = await startPkceFlow(c.env, parsed);
  return c.json(result);
});

const PkceExchangeSchema = z.object({
  providerId: z.string().min(1),
  pastedCallbackUrlOrCode: z.string().min(1),
  state: z.string().optional(),
  accountName: z.string().optional(),
});

/**
 * Paste-Callback URL / Auth Code Exchange Endpoint:
 * Allows users authenticating with CLI OAuth providers (Claude Code, Codex `localhost:1455`,
 * Gemini CLI `localhost:8085`, Antigravity) to paste the redirected URL from their browser bar!
 */
oauthRouter.post('/pkce/exchange', async (c) => {
  const raw = (await c.req.json()) as unknown;
  const parsed = PkceExchangeSchema.parse(raw);
  const result = await exchangePkcePasteCallback(c.env, parsed);
  return c.json({
    ok: true,
    ...result,
  });
});

oauthRouter.post('/refresh/:connectionId', async (c) => {
  const connId = c.req.param('connectionId');
  const conn = await c.env.DB.prepare(
    `SELECT id, name, provider, auth_type AS authType, encrypted_credentials AS encryptedCredentials,
            token_expires_at AS tokenExpiresAt
     FROM provider_connections WHERE id = ? LIMIT 1`
  )
    .bind(connId)
    .first<ProviderConnectionRow>();

  if (!conn) {
    return c.json({ error: 'Connection not found' }, 404);
  }

  const result = await refreshConnectionToken(c.env, conn);
  return c.json(result);
});
