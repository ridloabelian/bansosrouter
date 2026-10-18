import type { FlareRouteEnv, DecryptedCredentials } from '../types/env';
import type { ProviderConnectionRow } from '../db/schema';
import type {
  CanonicalRequest,
  CanonicalResponse,
  CanonicalStreamChunk,
  ProtocolFormat,
} from './translators/types';
import {
  buildOpenAIChatUpstreamBody,
  parseOpenAIChatResponse,
  formatOpenAIChatResponse,
  createCanonicalToOpenAIChatStream,
} from './translators/openai-chat';
import {
  formatOpenAIResponsesResponse,
  createCanonicalToOpenAIResponsesStream,
} from './translators/openai-responses';
import {
  buildAnthropicMessagesUpstreamBody,
  parseAnthropicMessagesResponse,
  formatAnthropicMessagesResponse,
  createCanonicalToAnthropicStream,
} from './translators/anthropic-messages';
import {
  buildGeminiUpstreamBody,
  parseGeminiResponse,
  formatGeminiResponse,
  createCanonicalToGeminiStream,
} from './translators/gemini';
import { decryptCredentials } from '../lib/crypto';
import { sanitizeString } from '../lib/sanitizer';
import { estimateTokensFromText, estimateRequestTokens } from '../lib/compression';
import { findProviderRegistryItem } from '../lib/catalogs';

export function getUpstreamProtocolForProvider(provider: string): ProtocolFormat | 'workers-ai' {
  const reg = findProviderRegistryItem(provider);
  if (reg) {
    return reg.protocol;
  }
  switch (provider) {
    case 'anthropic':
    case 'claude-code':
    case 'claude-web':
      return 'anthropic-messages';
    case 'gemini':
    case 'gemini-cli':
    case 'antigravity':
    case 'vertex':
      return 'gemini';
    case 'workers-ai':
    case 'cloudflare-playground':
      return 'workers-ai';
    default:
      return 'openai-chat';
  }
}

export function getDefaultBaseUrlForProvider(provider: string): string {
  const reg = findProviderRegistryItem(provider);
  if (reg && reg.baseUrl && !reg.baseUrl.startsWith('binding://')) {
    return reg.baseUrl;
  }
  switch (provider) {
    case 'anthropic':
    case 'claude-code':
      return 'https://api.anthropic.com';
    case 'openai':
    case 'codex':
      return 'https://api.openai.com/v1';
    case 'gemini':
    case 'gemini-cli':
    case 'antigravity':
      return 'https://generativelanguage.googleapis.com';
    case 'groq':
      return 'https://api.groq.com/openai/v1';
    case 'cerebras':
      return 'https://api.cerebras.ai/v1';
    case 'openrouter':
      return 'https://openrouter.ai/api/v1';
    case 'nvidia':
      return 'https://integrate.api.nvidia.com/v1';
    case 'mistral':
      return 'https://api.mistral.ai/v1';
    case 'github-copilot':
      return 'https://api.githubcopilot.com';
    case 'qwen':
      return 'https://portal.qwen.ai/v1';
    case 'kiro':
      return 'https://codewhisperer.us-east-1.amazonaws.com/v1';
    default:
      return 'https://api.openai.com/v1';
  }
}

/**
 * Format a `CanonicalResponse` into the client's requested inbound protocol JSON
 */
export function formatCanonicalResponseForClient(
  resp: CanonicalResponse,
  inboundProtocol: ProtocolFormat,
  enableSanitizer: boolean
): Record<string, unknown> {
  const sanitizedContent = sanitizeString(resp.content, enableSanitizer).text;
  const sanitizedThinking = resp.thinking
    ? sanitizeString(resp.thinking, enableSanitizer).text
    : undefined;

  const cleanResp: CanonicalResponse = {
    ...resp,
    content: sanitizedContent,
    thinking: sanitizedThinking,
  };

  switch (inboundProtocol) {
    case 'anthropic-messages':
      return formatAnthropicMessagesResponse(cleanResp);
    case 'openai-responses':
      return formatOpenAIResponsesResponse(cleanResp);
    case 'gemini':
      return formatGeminiResponse(cleanResp);
    case 'openai-chat':
    default:
      return formatOpenAIChatResponse(cleanResp);
  }
}

/**
 * Create the outbound SSE `TransformStream` matching the client's inbound protocol
 */
export function createOutboundProtocolStream(
  inboundProtocol: ProtocolFormat,
  model: string,
  enableSanitizer: boolean
): TransformStream<CanonicalStreamChunk, Uint8Array> {
  const sanitizeFn = (text: string): string => sanitizeString(text, enableSanitizer).text;
  switch (inboundProtocol) {
    case 'anthropic-messages':
      return createCanonicalToAnthropicStream(model, sanitizeFn);
    case 'openai-responses':
      return createCanonicalToOpenAIResponsesStream(model, sanitizeFn);
    case 'gemini':
      return createCanonicalToGeminiStream(model, sanitizeFn);
    case 'openai-chat':
    default:
      return createCanonicalToOpenAIChatStream(model, sanitizeFn);
  }
}

/**
 * Parse an upstream SSE `ReadableStream<Uint8Array>` (from OpenAI, Anthropic, or Gemini)
 * into a unified `ReadableStream<CanonicalStreamChunk>`.
 */
export function parseUpstreamSseToCanonicalStream(
  upstreamStream: ReadableStream<Uint8Array>,
  upstreamProtocol: ProtocolFormat,
  model: string,
  onComplete?: (usage: { promptTokens: number; completionTokens: number; cachedTokens: number }) => void
): ReadableStream<CanonicalStreamChunk> {
  const decoder = new TextDecoder();
  let buffer = '';
  let started = false;
  let promptTokens = 0;
  let completionTokens = 0;
  let cachedTokens = 0;

  const transform = new TransformStream<Uint8Array, CanonicalStreamChunk>({
    transform(chunk, controller) {
      if (!started) {
        started = true;
        controller.enqueue({ type: 'start', model });
      }

      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const dataStr = line.slice(5).trim();
        if (!dataStr || dataStr === '[DONE]') continue;

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(dataStr) as Record<string, unknown>;
        } catch {
          continue;
        }

        if (upstreamProtocol === 'anthropic-messages') {
          const eventType = typeof parsed.type === 'string' ? parsed.type : '';
          if (eventType === 'message_start' && parsed.message && typeof parsed.message === 'object') {
            const msgObj = parsed.message as Record<string, unknown>;
            if (msgObj.usage && typeof msgObj.usage === 'object') {
              const u = msgObj.usage as Record<string, unknown>;
              promptTokens = typeof u.input_tokens === 'number' ? u.input_tokens : promptTokens;
              cachedTokens =
                typeof u.cache_read_input_tokens === 'number'
                  ? u.cache_read_input_tokens
                  : cachedTokens;
            }
          } else if (
            eventType === 'content_block_delta' &&
            parsed.delta &&
            typeof parsed.delta === 'object'
          ) {
            const delta = parsed.delta as Record<string, unknown>;
            if (delta.type === 'text_delta' && typeof delta.text === 'string') {
              completionTokens += estimateTokensFromText(delta.text);
              controller.enqueue({ type: 'text_delta', textDelta: delta.text });
            } else if (delta.type === 'thinking_delta' && typeof delta.thinking === 'string') {
              completionTokens += estimateTokensFromText(delta.thinking);
              controller.enqueue({ type: 'thinking_delta', thinkingDelta: delta.thinking });
            } else if (
              delta.type === 'input_json_delta' &&
              typeof delta.partial_json === 'string'
            ) {
              controller.enqueue({
                type: 'tool_call_delta',
                toolArgumentsDelta: delta.partial_json,
              });
            }
          } else if (eventType === 'message_delta' && parsed.usage && typeof parsed.usage === 'object') {
            const u = parsed.usage as Record<string, unknown>;
            if (typeof u.output_tokens === 'number') completionTokens = u.output_tokens;
          }
          continue;
        }

        if (upstreamProtocol === 'gemini') {
          const candidates = Array.isArray(parsed.candidates) ? parsed.candidates : [];
          const first =
            candidates[0] && typeof candidates[0] === 'object'
              ? (candidates[0] as Record<string, unknown>)
              : {};
          const content =
            first.content && typeof first.content === 'object'
              ? (first.content as Record<string, unknown>)
              : {};
          const parts = Array.isArray(content.parts) ? content.parts : [];
          for (const part of parts) {
            if (!part || typeof part !== 'object') continue;
            const p = part as Record<string, unknown>;
            if (p.thought === true && typeof p.text === 'string') {
              completionTokens += estimateTokensFromText(p.text);
              controller.enqueue({ type: 'thinking_delta', thinkingDelta: p.text });
            } else if (typeof p.text === 'string' && p.text.length > 0) {
              completionTokens += estimateTokensFromText(p.text);
              controller.enqueue({ type: 'text_delta', textDelta: p.text });
            }
          }
          if (parsed.usageMetadata && typeof parsed.usageMetadata === 'object') {
            const u = parsed.usageMetadata as Record<string, unknown>;
            if (typeof u.promptTokenCount === 'number') promptTokens = u.promptTokenCount;
            if (typeof u.candidatesTokenCount === 'number')
              completionTokens = u.candidatesTokenCount;
          }
          continue;
        }

        // Default: OpenAI Chat Completions chunk format
        const choices = Array.isArray(parsed.choices) ? parsed.choices : [];
        const firstChoice =
          choices[0] && typeof choices[0] === 'object'
            ? (choices[0] as Record<string, unknown>)
            : {};
        const delta =
          firstChoice.delta && typeof firstChoice.delta === 'object'
            ? (firstChoice.delta as Record<string, unknown>)
            : {};

        if (typeof delta.reasoning_content === 'string' && delta.reasoning_content.length > 0) {
          completionTokens += estimateTokensFromText(delta.reasoning_content);
          controller.enqueue({
            type: 'thinking_delta',
            thinkingDelta: delta.reasoning_content,
          });
        }
        if (typeof delta.content === 'string' && delta.content.length > 0) {
          completionTokens += estimateTokensFromText(delta.content);
          controller.enqueue({
            type: 'text_delta',
            textDelta: delta.content,
          });
        }
        if (Array.isArray(delta.tool_calls)) {
          for (const tc of delta.tool_calls) {
            if (!tc || typeof tc !== 'object') continue;
            const tcObj = tc as Record<string, unknown>;
            const fn =
              tcObj.function && typeof tcObj.function === 'object'
                ? (tcObj.function as Record<string, unknown>)
                : {};
            controller.enqueue({
              type: 'tool_call_delta',
              toolCallIndex: typeof tcObj.index === 'number' ? tcObj.index : 0,
              toolCallId: typeof tcObj.id === 'string' ? tcObj.id : undefined,
              toolName: typeof fn.name === 'string' ? fn.name : undefined,
              toolArgumentsDelta: typeof fn.arguments === 'string' ? fn.arguments : undefined,
            });
          }
        }
        if (parsed.usage && typeof parsed.usage === 'object') {
          const u = parsed.usage as Record<string, unknown>;
          if (typeof u.prompt_tokens === 'number') promptTokens = u.prompt_tokens;
          if (typeof u.completion_tokens === 'number') completionTokens = u.completion_tokens;
        }
      }
    },
    flush(controller) {
      if (!started) {
        controller.enqueue({ type: 'start', model });
      }
      controller.enqueue({
        type: 'done',
        finishReason: 'stop',
        promptTokens,
        completionTokens,
        cachedTokens,
      });
      if (onComplete) {
        onComplete({ promptTokens, completionTokens, cachedTokens });
      }
    },
  });

  return upstreamStream.pipeThrough(transform);
}

/**
 * Execute a `CanonicalRequest` against the chosen `ProviderConnectionRow`.
 * Supports both non-streaming (`CanonicalResponse`) and streaming (`ReadableStream<CanonicalStreamChunk>`).
 */
export async function executeUpstreamCandidate(
  env: FlareRouteEnv,
  connection: ProviderConnectionRow,
  targetModel: string,
  req: CanonicalRequest,
  onStreamUsage?: (usage: { promptTokens: number; completionTokens: number; cachedTokens: number }) => void
): Promise<
  | { kind: 'json'; response: CanonicalResponse }
  | { kind: 'stream'; stream: ReadableStream<CanonicalStreamChunk> }
> {
  const creds: DecryptedCredentials = await decryptCredentials(
    connection.encryptedCredentials,
    env.ENCRYPTION_SECRET
  );
  const bearerToken = creds.copilotToken ?? creds.accessToken ?? creds.apiKey ?? '';
  const upstreamProto = getUpstreamProtocolForProvider(connection.provider);

  // 1. Native Cloudflare Workers AI binding (`env.AI`) or built-in simulated Bansos test account
  if (
    upstreamProto === 'workers-ai' ||
    bearerToken === 'flareroute-demo-key' ||
    bearerToken === 'bansos-demo-free-key'
  ) {
    const promptTokens = estimateRequestTokens(req.messages, req.systemPrompt);
    let replyText = '';

    if (upstreamProto === 'workers-ai' && env.AI) {
      const cfMessages = [
        ...(req.systemPrompt ? [{ role: 'system', content: req.systemPrompt }] : []),
        ...req.messages.map((m) => ({ role: m.role, content: m.content })),
      ];
      const aiResult = (await env.AI.run(targetModel, {
        messages: cfMessages,
      })) as Record<string, unknown>;
      replyText =
        typeof aiResult.response === 'string'
          ? aiResult.response
          : JSON.stringify(aiResult);
    } else {
      const lastUser = [...req.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
      replyText = `[BansosRouter Edge Gateway (Rp 0 / $0 Lock) — ${connection.name} (${targetModel})]\nBerhasil memproses request Anda (${promptTokens} token setelah kompresi 10-Layer) dengan biaya Rp 0 ($0.00). Pesan terakhir: "${lastUser.slice(
        0,
        160
      )}"`;
    }

    const completionTokens = estimateTokensFromText(replyText);

    if (!req.stream) {
      return {
        kind: 'json',
        response: {
          id: `bansos_${crypto.randomUUID().slice(0, 18)}`,
          model: targetModel,
          content: replyText,
          finishReason: 'stop',
          usage: {
            promptTokens,
            completionTokens,
            cachedTokens: 0,
            totalTokens: promptTokens + completionTokens,
          },
        },
      };
    }

    // Emit synthetic CanonicalStreamChunk stream for Workers AI / Bansos Demo connection
    const words = replyText.split(/(?=\s)/);
    const stream = new ReadableStream<CanonicalStreamChunk>({
      start(controller) {
        controller.enqueue({ type: 'start', model: targetModel, promptTokens });
        for (const w of words) {
          controller.enqueue({ type: 'text_delta', textDelta: w });
        }
        controller.enqueue({
          type: 'done',
          finishReason: 'stop',
          promptTokens,
          completionTokens,
          cachedTokens: 0,
        });
        if (onStreamUsage) {
          onStreamUsage({ promptTokens, completionTokens, cachedTokens: 0 });
        }
        controller.close();
      },
    });
    return { kind: 'stream', stream };
  }

  // 2. External Upstream HTTP / SSE Fetch (`anthropic`, `gemini`, or `openai-chat` compatible)
  const baseUrl = (
    connection.baseUrl && connection.baseUrl.trim().length > 0
      ? connection.baseUrl.trim()
      : getDefaultBaseUrlForProvider(connection.provider)
  ).replace(/\/+$/, '');

  let url = `${baseUrl}/chat/completions`;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(creds.extraHeaders ?? {}),
  };
  let bodyObj: Record<string, unknown>;

  if (upstreamProto === 'anthropic-messages') {
    url = baseUrl.endsWith('/v1') ? `${baseUrl}/messages` : `${baseUrl}/v1/messages`;
    headers['anthropic-version'] = '2023-06-01';
    headers['anthropic-beta'] = 'prompt-caching-2024-07-31,interleaved-thinking-2025-05-14';
    if (connection.authType.startsWith('oauth') || bearerToken.startsWith('sk-ant-oat')) {
      headers['authorization'] = `Bearer ${bearerToken}`;
    } else {
      headers['x-api-key'] = bearerToken;
    }
    bodyObj = buildAnthropicMessagesUpstreamBody(req, targetModel);
  } else if (upstreamProto === 'gemini') {
    const action = req.stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
    if (connection.authType.startsWith('oauth') || connection.authType === 'service_account') {
      url = `${baseUrl}/v1beta/models/${encodeURIComponent(targetModel)}:${action}`;
      headers['authorization'] = `Bearer ${bearerToken}`;
    } else {
      const sep = action.includes('?') ? '&' : '?';
      url = `${baseUrl}/v1beta/models/${encodeURIComponent(targetModel)}:${action}${sep}key=${encodeURIComponent(
        bearerToken
      )}`;
    }
    bodyObj = buildGeminiUpstreamBody(req);
  } else {
    // OpenAI Chat compatible (`groq`, `cerebras`, `openrouter`, `nvidia`, `mistral`, `bigmodel`, `modelscope`, `siliconflow`, `github-models`, `llm7`, `pollinations`, etc.)
    url = `${baseUrl}/chat/completions`;
    const effectiveBearer =
      bearerToken && bearerToken !== 'bansos-zero-key' ? bearerToken : 'unused';
    if (connection.authType !== 'no_auth' || connection.provider.startsWith('llm7')) {
      headers['authorization'] = `Bearer ${effectiveBearer}`;
    }
    if (connection.provider === 'github-copilot') {
      headers['editor-version'] = 'vscode/1.97.0';
      headers['copilot-integration-id'] = 'vscode-chat';
    } else if (connection.provider === 'openrouter') {
      headers['http-referer'] = 'https://bansosrouter.workers.dev';
      headers['x-title'] = 'BansosRouter (100% Free LLM Gateway)';
    }
    bodyObj = buildOpenAIChatUpstreamBody(req, targetModel);
  }

  const upstreamRes = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(bodyObj),
  });

  if (!upstreamRes.ok) {
    const errorText = await upstreamRes.text().catch(() => `HTTP ${upstreamRes.status}`);
    const err = new Error(errorText || `Upstream HTTP ${upstreamRes.status}`) as Error & {
      statusCode?: number;
      retryAfter?: string | null;
    };
    err.statusCode = upstreamRes.status;
    err.retryAfter = upstreamRes.headers.get('retry-after');
    throw err;
  }

  if (req.stream && upstreamRes.body) {
    const canonicalStream = parseUpstreamSseToCanonicalStream(
      upstreamRes.body,
      upstreamProto,
      targetModel,
      onStreamUsage
    );
    return { kind: 'stream', stream: canonicalStream };
  }

  const rawJson = (await upstreamRes.json()) as Record<string, unknown>;
  let canonicalResp: CanonicalResponse;
  if (upstreamProto === 'anthropic-messages') {
    canonicalResp = parseAnthropicMessagesResponse(rawJson, targetModel);
  } else if (upstreamProto === 'gemini') {
    canonicalResp = parseGeminiResponse(rawJson, targetModel);
  } else {
    canonicalResp = parseOpenAIChatResponse(rawJson, targetModel);
  }

  return { kind: 'json', response: canonicalResp };
}
