import { Hono } from 'hono';
import { ROUTING_STRATEGIES, VIRTUAL_AUTO_COMBOS, type FlareRouteEnv } from '../types/env';
import type { ProviderConnectionRow, ComboRow, ApiKeyRow } from '../db/schema';
import { listActiveResilienceStates } from '../lib/resilience';
import { retrieveFromCcr } from '../lib/compression/ccr';
import { sha256Hex } from '../lib/crypto';

export const mcpRouter = new Hono<{ Bindings: FlareRouteEnv }>();

mcpRouter.use('*', async (c, next) => {
  const rawToken =
    c.req.header('x-admin-token') ??
    c.req.header('x-api-key') ??
    c.req.header('authorization')?.replace(/^Bearer\s+/i, '');

  if (!rawToken) {
    return c.json({ error: 'Unauthorized: Provide Authorization: Bearer fr_live_... or x-admin-token' }, 401);
  }

  if (c.env.ADMIN_PASSWORD) {
    const adminSessionToken = await sha256Hex(`flareroute-admin:admin:${c.env.ADMIN_PASSWORD}`);
    if (rawToken === c.env.ADMIN_PASSWORD || rawToken === adminSessionToken) {
      return next();
    }
  }

  const keyHash = await sha256Hex(rawToken);
  const apiKey = await c.env.DB.prepare(
    `SELECT id FROM api_keys WHERE key_hash = ? AND is_active = 1 LIMIT 1`
  )
    .bind(keyHash)
    .first<Pick<ApiKeyRow, 'id'>>();

  if (apiKey) {
    return next();
  }
  return c.json({ error: 'Unauthorized: Invalid MCP token' }, 401);
});

const MCP_TOOLS = [
  {
    name: 'flareroute_status',
    description:
      'Get real-time FlareRoute gateway health, provider connections, 3-layer resilience lockouts, and token compression savings.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'flareroute_list_combos',
    description:
      'List all virtual auto/* combos and custom routing combos with their active strategy (1 of 19 strategies).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'flareroute_set_combo_strategy',
    description:
      'Switch the active routing strategy of any combo (e.g., auto, auto/coding) to one of the 19 FlareRoute strategies.',
    inputSchema: {
      type: 'object',
      properties: {
        comboSlug: {
          type: 'string',
          description: 'Combo slug such as "auto", "auto/coding", "auto/fast", or custom slug',
        },
        strategy: {
          type: 'string',
          enum: [...ROUTING_STRATEGIES],
          description: 'One of the 19 routing strategies',
        },
      },
      required: ['comboSlug', 'strategy'],
    },
  },
  {
    name: 'flareroute_recall_ccr',
    description:
      'Retrieve the full original uncompressed text of an archived Context Control & Recovery block ([CCR:ccr_xxx]) from Cloudflare KV.',
    inputSchema: {
      type: 'object',
      properties: {
        ccrId: {
          type: 'string',
          description: 'The CCR identifier, e.g. "ccr_a1b2c3d4e5f6" or "[CCR:ccr_a1b2c3d4e5f6]"',
        },
      },
      required: ['ccrId'],
    },
  },
  {
    name: 'flareroute_clear_lockouts',
    description:
      'Clear all active Layer 1 circuit breakers, Layer 2 connection cooldowns, and Layer 3 per-model lockouts in Cloudflare KV.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

/**
 * GET /api/mcp/stream — SSE transport endpoint for MCP clients
 */
mcpRouter.get('/stream', (c) => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(`event: endpoint\ndata: /api/mcp/stream\n\n`));
      controller.enqueue(
        encoder.encode(
          `event: ready\ndata: ${JSON.stringify({
            server: 'flareroute-mcp',
            version: c.env.FLAREROUTE_VERSION ?? '1.0.0',
            toolsCount: MCP_TOOLS.length,
          })}\n\n`
        )
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    },
  });
});

/**
 * POST /api/mcp/stream — Streamable HTTP JSON-RPC 2.0 MCP Server
 */
mcpRouter.post('/stream', async (c) => {
  const body = (await c.req.json()) as {
    jsonrpc?: string;
    id?: string | number | null;
    method?: string;
    params?: Record<string, unknown>;
  };

  const rpcId = body.id ?? 1;
  const method = body.method ?? '';

  if (method === 'initialize') {
    return c.json({
      jsonrpc: '2.0',
      id: rpcId,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: false },
        },
        serverInfo: {
          name: 'flareroute-cloudflare-mcp',
          version: c.env.FLAREROUTE_VERSION ?? '1.0.0',
        },
      },
    });
  }

  if (method === 'tools/list') {
    return c.json({
      jsonrpc: '2.0',
      id: rpcId,
      result: {
        tools: MCP_TOOLS,
      },
    });
  }

  if (method === 'tools/call') {
    const toolName = typeof body.params?.name === 'string' ? body.params.name : '';
    const args =
      body.params?.arguments && typeof body.params.arguments === 'object'
        ? (body.params.arguments as Record<string, unknown>)
        : {};

    if (toolName === 'flareroute_status') {
      const [conns, resilience, savingsRow] = await Promise.all([
        c.env.DB.prepare(
          `SELECT id, name, provider, tier, status, tokens_used_today AS tokensUsedToday,
                  daily_token_limit AS dailyTokenLimit, tokens_used_window AS tokensUsedWindow,
                  window_token_limit AS windowTokenLimit, avg_latency_ms AS avgLatencyMs
           FROM provider_connections`
        ).all<ProviderConnectionRow>(),
        listActiveResilienceStates(c.env.FLAREROUTE_KV),
        c.env.DB.prepare(
          `SELECT COALESCE(SUM(tokens_saved), 0) AS totalSaved,
                  COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS totalProcessed,
                  COALESCE(SUM(cost_usd), 0) AS totalCostUsd,
                  COUNT(*) AS totalRequests
           FROM usage_logs`
        ).first<Record<string, number>>(),
      ]);

      return c.json({
        jsonrpc: '2.0',
        id: rpcId,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  connections: conns.results,
                  resilience,
                  telemetry: savingsRow,
                  virtualCombos: VIRTUAL_AUTO_COMBOS,
                },
                null,
                2
              ),
            },
          ],
        },
      });
    }

    if (toolName === 'flareroute_list_combos') {
      const combosRes = await c.env.DB.prepare(
        `SELECT id, slug, name, description, strategy, compression_profile AS compressionProfile, is_active AS isActive
         FROM combos ORDER BY is_system DESC, slug ASC`
      ).all<ComboRow>();

      return c.json({
        jsonrpc: '2.0',
        id: rpcId,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(combosRes.results, null, 2),
            },
          ],
        },
      });
    }

    if (toolName === 'flareroute_set_combo_strategy') {
      const slug = typeof args.comboSlug === 'string' ? args.comboSlug : 'auto';
      const strategy = typeof args.strategy === 'string' ? args.strategy : 'p2c';

      if (!ROUTING_STRATEGIES.includes(strategy as (typeof ROUTING_STRATEGIES)[number])) {
        return c.json({
          jsonrpc: '2.0',
          id: rpcId,
          error: { code: -32602, message: `Invalid strategy: ${strategy}` },
        });
      }

      await c.env.DB.prepare(`UPDATE combos SET strategy = ?, updated_at = ? WHERE slug = ?`)
        .bind(strategy, Date.now(), slug)
        .run();

      return c.json({
        jsonrpc: '2.0',
        id: rpcId,
        result: {
          content: [
            {
              type: 'text',
              text: `Updated combo "${slug}" strategy to "${strategy}".`,
            },
          ],
        },
      });
    }

    if (toolName === 'flareroute_recall_ccr') {
      const ccrId = typeof args.ccrId === 'string' ? args.ccrId : '';
      const entry = await retrieveFromCcr(c.env.FLAREROUTE_KV, ccrId);
      return c.json({
        jsonrpc: '2.0',
        id: rpcId,
        result: {
          content: [
            {
              type: 'text',
              text: entry
                ? entry.content
                : `CCR block "${ccrId}" was not found or has expired from Cloudflare KV.`,
            },
          ],
        },
      });
    }

    if (toolName === 'flareroute_clear_lockouts') {
      const [cb, cd, lk] = await Promise.all([
        c.env.FLAREROUTE_KV.list({ prefix: 'cb:provider:' }),
        c.env.FLAREROUTE_KV.list({ prefix: 'cd:conn:' }),
        c.env.FLAREROUTE_KV.list({ prefix: 'lock:conn:' }),
      ]);
      const allKeys = [...cb.keys, ...cd.keys, ...lk.keys];
      await Promise.all(allKeys.map((k) => c.env.FLAREROUTE_KV.delete(k.name)));
      await c.env.DB.prepare(
        `UPDATE provider_connections SET status = 'active', consecutive_failures = 0 WHERE status IN ('cooldown', 'circuit_open')`
      ).run();

      return c.json({
        jsonrpc: '2.0',
        id: rpcId,
        result: {
          content: [
            {
              type: 'text',
              text: `Cleared ${allKeys.length} resilience lockout/cooldown records from Cloudflare KV.`,
            },
          ],
        },
      });
    }
  }

  return c.json({
    jsonrpc: '2.0',
    id: rpcId,
    error: { code: -32601, message: `Method not found: ${method}` },
  });
});

/**
 * Build A2A (`/.well-known/agent.json`) Discovery Card
 */
export function buildA2AAgentCard(origin: string, version = '1.0.0'): Record<string, unknown> {
  return {
    name: 'FlareRoute Cloudflare-Native AI Gateway',
    description:
      '100% Serverless Multi-Account OAuth AI Router, 19-Strategy Load Balancer, 3-Layer Resilience Engine & 10-Layer Token Optimizer on Cloudflare Workers + D1 + KV.',
    url: origin,
    version,
    protocol: 'a2a/1.0',
    capabilities: {
      streaming: true,
      pushNotifications: true,
      stateTransitionHistory: true,
      protocolsSupported: [
        'openai-chat-completions',
        'openai-responses-codex',
        'anthropic-messages-claude-code',
        'google-gemini-v1beta',
        'mcp-streamable-http',
      ],
      routingStrategies: ROUTING_STRATEGIES,
      virtualAutoCombos: VIRTUAL_AUTO_COMBOS,
    },
    endpoints: {
      openaiChat: `${origin}/v1/chat/completions`,
      openaiResponses: `${origin}/v1/responses`,
      anthropicMessages: `${origin}/v1/messages`,
      geminiGenerate: `${origin}/v1beta/models/{model}:generateContent`,
      mcpStream: `${origin}/api/mcp/stream`,
      dashboard: `${origin}/dashboard`,
    },
    skills: MCP_TOOLS.map((t) => ({
      id: t.name,
      name: t.name,
      description: t.description,
    })),
  };
}
