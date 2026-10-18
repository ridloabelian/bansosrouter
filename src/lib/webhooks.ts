import type { D1Database } from '../types/env';
import type { WebhookRow } from '../db/schema';

export type WebhookEventType =
  | 'circuit_open'
  | 'budget_exceeded'
  | 'oauth_refresh_failed'
  | 'model_lockout'
  | 'test_ping';

export interface WebhookEventPayload {
  event: WebhookEventType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Non-blocking outbound webhook dispatcher (invoked via `executionCtx.waitUntil()`).
 * Formats payloads natively for Discord, Slack, Telegram, or Generic JSON endpoints.
 */
export async function dispatchWebhookEvent(
  d1: D1Database,
  payload: WebhookEventPayload
): Promise<void> {
  try {
    const res = await d1
      .prepare(
        `SELECT id, name, type, target_url AS targetUrl, secret_header AS secretHeader,
                events_json AS eventsJson, is_active AS isActive,
                last_triggered_at AS lastTriggeredAt, last_status AS lastStatus, created_at AS createdAt
         FROM webhooks WHERE is_active = 1`
      )
      .all<WebhookRow>();

    const hooks = res.results;
    if (hooks.length === 0) return;

    const now = Date.now();

    await Promise.allSettled(
      hooks.map(async (hook) => {
        let subscribedEvents: string[] = [];
        try {
          const parsed: unknown = JSON.parse(hook.eventsJson);
          if (Array.isArray(parsed)) {
            subscribedEvents = parsed.filter((e): e is string => typeof e === 'string');
          }
        } catch {
          subscribedEvents = [];
        }

        if (
          payload.event !== 'test_ping' &&
          subscribedEvents.length > 0 &&
          !subscribedEvents.includes(payload.event)
        ) {
          return;
        }

        let bodyObj: Record<string, unknown>;
        if (hook.type === 'discord') {
          bodyObj = {
            username: 'FlareRoute Gateway',
            embeds: [
              {
                title: `⚡ ${payload.title}`,
                description: payload.message,
                color: payload.event === 'test_ping' ? 0x10b981 : 0xf97316,
                timestamp: new Date(now).toISOString(),
              },
            ],
          };
        } else if (hook.type === 'slack') {
          bodyObj = {
            text: `*⚡ [FlareRoute] ${payload.title}*\n${payload.message}`,
          };
        } else if (hook.type === 'telegram') {
          bodyObj = {
            text: `⚡ [FlareRoute] ${payload.title}\n\n${payload.message}`,
          };
        } else {
          bodyObj = {
            source: 'flareroute',
            timestamp: now,
            ...payload,
          };
        }

        const headers: Record<string, string> = {
          'content-type': 'application/json',
        };
        if (hook.secretHeader) {
          headers['x-flareroute-signature'] = hook.secretHeader;
        }

        const resp = await fetch(hook.targetUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(bodyObj),
        });

        await d1
          .prepare(`UPDATE webhooks SET last_triggered_at = ?, last_status = ? WHERE id = ?`)
          .bind(now, resp.status, hook.id)
          .run();
      })
    );
  } catch {
    // Never throw inside background waitUntil()
  }
}
