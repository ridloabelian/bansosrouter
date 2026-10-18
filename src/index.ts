import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type {
  FlareRouteEnv,
  ScheduledController,
  WorkerExecutionContext,
} from './types/env';
import { ensureDatabaseInitialized } from './db';
import { gatewayRouter } from './routes/gateway';
import { adminRouter } from './routes/admin';
import { oauthRouter } from './routes/oauth';
import { mcpRouter, buildA2AAgentCard } from './routes/mcp';
import { runScheduledMaintenance } from './lib/oauth';

const app = new Hono<{ Bindings: FlareRouteEnv }>();

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'x-api-key',
      'x-goog-api-key',
      'x-admin-token',
      'anthropic-version',
      'anthropic-beta',
      'x-bansosrouter-strategy',
      'x-bansosrouter-compression',
      'x-flareroute-strategy',
      'x-flareroute-compression',
    ],
    exposeHeaders: [
      'X-BansosRouter-Provider',
      'X-BansosRouter-Model',
      'X-BansosRouter-Strategy',
      'X-BansosRouter-Cost-USD',
      'X-BansosRouter-Cost-IDR',
      'X-BansosRouter-Tokens-Saved',
      'X-FlareRoute-Provider',
      'X-FlareRoute-Model',
      'X-FlareRoute-Strategy',
      'X-FlareRoute-Latency-Ms',
      'X-FlareRoute-Tokens-Saved',
      'X-FlareRoute-Compression-Layers',
      'X-FlareRoute-Cache',
    ],
  })
);

// Auto-bootstrap D1 schema & system bansos/* combos on first request
app.use('*', async (c, next) => {
  if (c.env.DB) {
    await ensureDatabaseInitialized(c.env.DB);
  }
  return next();
});

// Health & Architecture Endpoint
app.get('/api/health', (c) => {
  return c.json({
    name: 'BansosRouter',
    tagline: 'Router AI Bantuan Sosial 100% Gratis (Rp 0 / $0 Lock) untuk Developer Jelata',
    status: 'healthy',
    zeroCostLock: true,
    runtime: 'cloudflare-workers-workerd',
    version: c.env.FLAREROUTE_VERSION ?? '1.0.0-bansos',
    features: {
      protocols: [
        'openai-chat-completions',
        'openai-responses-codex',
        'anthropic-messages-claude-code',
        'google-gemini-v1beta',
      ],
      freeProvidersCatalog: 24,
      routingStrategies: 19,
      resilienceLayers: 3,
      compressionLayers: 10,
      encryption: 'WebCrypto AES-256-GCM',
      mcpEndpoint: '/api/mcp/stream',
      a2aEndpoint: '/.well-known/agent.json',
    },
    timestamp: new Date().toISOString(),
  });
});

// A2A Agent Discovery Card
app.get('/.well-known/agent.json', (c) => {
  const origin = new URL(c.req.url).origin;
  return c.json(buildA2AAgentCard(origin, c.env.FLAREROUTE_VERSION ?? '1.0.0-bansos'));
});

// Mount API & Gateway Routers
app.route('/api/oauth', oauthRouter);
app.route('/api/mcp', mcpRouter);
app.route('/api/admin', adminRouter);
app.route('/', gatewayRouter);

// Fallback to Cloudflare Workers Static Assets (React 19 Dashboard SPA)
app.all('*', async (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.html(`<!doctype html>
<html>
  <head><title>BansosRouter — 100% Free AI Gateway</title></head>
  <body style="background:#020617;color:#f8fafc;font-family:system-ui;padding:2rem;">
    <h1>🌾 BansosRouter Worker Aktif (Rp 0 / $0 Lock)</h1>
    <p>Jalankan <code>npm run build</code> untuk mem-bundle Dashboard React 19 ke <code>./dist/client</code>.</p>
  </body>
</html>`);
});

export default {
  fetch(
    request: Request,
    env: FlareRouteEnv,
    ctx: WorkerExecutionContext
  ): Response | Promise<Response> {
    return app.fetch(request, env, ctx);
  },

  /**
   * Cloudflare Cron Trigger Handler (every 15 minutes):
   * Proactively refreshes expiring OAuth tokens, resets 5-hour/daily subscription windows,
   * and prunes old telemetry logs in D1.
   */
  async scheduled(
    _controller: ScheduledController,
    env: FlareRouteEnv,
    ctx: WorkerExecutionContext
  ): Promise<void> {
    ctx.waitUntil(
      (async () => {
        await ensureDatabaseInitialized(env.DB);
        await runScheduledMaintenance(env);
      })()
    );
  },
};
