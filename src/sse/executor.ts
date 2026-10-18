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

export interface SdkFingerprintPersona {
  slot: number;
  label: string;
  userAgent: string;
  headers: Record<string, string>;
}

/**
 * 16 Distinct Official SDK Fingerprint Personas for Multi-Account Isolation.
 * Each connection (`connection.id` or `personaSlot`) is deterministically pinned to a single
 * consistent SDK identity so 10+ accounts on the same provider (e.g. Z.AI / BigModel, Groq, Gemini)
 * appear as separate client applications/environments while remaining sticky per account.
 */
export const SDK_FINGERPRINT_POOL: Array<Omit<SdkFingerprintPersona, 'slot'>> = [
  {
    label: 'OpenAI/Python 1.64.0 (macOS arm64 • Py 3.12)',
    userAgent: 'OpenAI/Python 1.64.0',
    headers: {
      'user-agent': 'OpenAI/Python 1.64.0',
      'x-stainless-lang': 'python',
      'x-stainless-package-version': '1.64.0',
      'x-stainless-os': 'MacOS',
      'x-stainless-arch': 'arm64',
      'x-stainless-runtime': 'CPython',
      'x-stainless-runtime-version': '3.12.8',
      'accept-language': 'en-US,en;q=0.9',
    },
  },
  {
    label: 'OpenAI/JS 4.86.1 (Linux x64 • Node 22.13)',
    userAgent: 'OpenAI/JS 4.86.1',
    headers: {
      'user-agent': 'OpenAI/JS 4.86.1',
      'x-stainless-lang': 'js',
      'x-stainless-package-version': '4.86.1',
      'x-stainless-os': 'Linux',
      'x-stainless-arch': 'x64',
      'x-stainless-runtime': 'node',
      'x-stainless-runtime-version': 'v22.13.1',
      'accept-language': 'en-US,en;q=0.8,id;q=0.7',
    },
  },
  {
    label: 'zhipuai-sdk-python/2.1.5 (Linux x86_64 • Py 3.11)',
    userAgent: 'zhipuai-sdk-python/2.1.5.20250106 python/3.11.11 Linux/6.8.0-51-generic',
    headers: {
      'user-agent': 'zhipuai-sdk-python/2.1.5.20250106 python/3.11.11 Linux/6.8.0-51-generic',
      'x-request-sdk': 'zhipuai-sdk-python/2.1.5',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
  },
  {
    label: 'Vercel AI SDK 4.1.22 (Node 20.18)',
    userAgent: 'ai-sdk/openai/1.1.14 runtime/node.js/20.18.2',
    headers: {
      'user-agent': 'ai-sdk/openai/1.1.14 runtime/node.js/20.18.2',
      'accept-language': 'en-US,en;q=0.9',
    },
  },
  {
    label: 'LangChain-OpenAI/0.3.7 (Ubuntu • Py 3.12)',
    userAgent: 'langchain-openai/0.3.7 (Python 3.12.6; Linux x86_64)',
    headers: {
      'user-agent': 'langchain-openai/0.3.7 (Python 3.12.6; Linux x86_64)',
      'x-stainless-lang': 'python',
      'x-stainless-package-version': '1.61.1',
      'x-stainless-os': 'Linux',
      'x-stainless-arch': 'x86_64',
      'x-stainless-runtime': 'CPython',
      'x-stainless-runtime-version': '3.12.6',
      'accept-language': 'en-US,en;q=0.9',
    },
  },
  {
    label: 'OpenAI/Go 1.37.0 (Go 1.23.5 • linux/amd64)',
    userAgent: 'OpenAI/Go 1.37.0 (go1.23.5; linux/amd64)',
    headers: {
      'user-agent': 'OpenAI/Go 1.37.0 (go1.23.5; linux/amd64)',
      'accept-language': 'en-US,en;q=0.9',
    },
  },
  {
    label: 'LiteLLM/1.61.15 (macOS arm64 • Py 3.11)',
    userAgent: 'litellm/1.61.15',
    headers: {
      'user-agent': 'litellm/1.61.15',
      'x-stainless-lang': 'python',
      'x-stainless-package-version': '1.59.8',
      'x-stainless-os': 'MacOS',
      'x-stainless-arch': 'arm64',
      'accept-language': 'en-US,en;q=0.9',
    },
  },
  {
    label: 'LlamaIndex/0.12.16 (Win11 amd64 • Py 3.12)',
    userAgent: 'llama-index-py/0.12.16 (Python 3.12.4; Windows-11-amd64)',
    headers: {
      'user-agent': 'llama-index-py/0.12.16 (Python 3.12.4; Windows-11-amd64)',
      'x-stainless-lang': 'python',
      'x-stainless-package-version': '1.58.1',
      'x-stainless-os': 'Windows',
      'x-stainless-arch': 'amd64',
      'accept-language': 'en-US,en;q=0.9',
    },
  },
  {
    label: 'OpenAI/JS 4.82.0 (Bun 1.2.2 • darwin/arm64)',
    userAgent: 'OpenAI/JS 4.82.0',
    headers: {
      'user-agent': 'OpenAI/JS 4.82.0',
      'x-stainless-lang': 'js',
      'x-stainless-package-version': '4.82.0',
      'x-stainless-os': 'MacOS',
      'x-stainless-arch': 'arm64',
      'x-stainless-runtime': 'bun',
      'x-stainless-runtime-version': '1.2.2',
      'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8',
    },
  },
  {
    label: 'OpenAI-DotNet/2.1.0 (.NET 9.0 • win-x64)',
    userAgent: 'OpenAI-DotNet/2.1.0 (.NET 9.0.2; Microsoft Windows 10.0.22631)',
    headers: {
      'user-agent': 'OpenAI-DotNet/2.1.0 (.NET 9.0.2; Microsoft Windows 10.0.22631)',
      'accept-language': 'en-SG,en;q=0.9,id-ID;q=0.8',
    },
  },
  {
    label: 'SpringAI/1.0.0-M6 (Java 21 • Linux aarch64)',
    userAgent: 'SpringAI/1.0.0-M6 (Java/21.0.6; Linux/aarch64)',
    headers: {
      'user-agent': 'SpringAI/1.0.0-M6 (Java/21.0.6; Linux/aarch64)',
      'accept-language': 'en-US,en;q=0.9',
    },
  },
  {
    label: 'async-openai/0.27.2 (Rust reqwest/0.12 • Linux x64)',
    userAgent: 'async-openai/0.27.2 reqwest/0.12.12',
    headers: {
      'user-agent': 'async-openai/0.27.2 reqwest/0.12.12',
      'accept-language': 'en-GB,en;q=0.9',
    },
  },
  {
    label: 'OpenAI/Python 1.57.4 (Win11 amd64 • Py 3.11)',
    userAgent: 'OpenAI/Python 1.57.4',
    headers: {
      'user-agent': 'OpenAI/Python 1.57.4',
      'x-stainless-lang': 'python',
      'x-stainless-package-version': '1.57.4',
      'x-stainless-os': 'Windows',
      'x-stainless-arch': 'amd64',
      'x-stainless-runtime': 'CPython',
      'x-stainless-runtime-version': '3.11.8',
      'accept-language': 'en-US,en;q=0.9',
    },
  },
  {
    label: 'OpenAI/JS 4.79.3 (Deno 2.1.9 • Linux x64)',
    userAgent: 'OpenAI/JS 4.79.3',
    headers: {
      'user-agent': 'OpenAI/JS 4.79.3',
      'x-stainless-lang': 'js',
      'x-stainless-package-version': '4.79.3',
      'x-stainless-os': 'Linux',
      'x-stainless-arch': 'x64',
      'x-stainless-runtime': 'deno',
      'x-stainless-runtime-version': '2.1.9',
      'accept-language': 'en-US,en;q=0.9',
    },
  },
  {
    label: 'zhipuai-sdk-java/2.3.0 (OkHttp 4.12 • Java 17)',
    userAgent: 'zhipuai-sdk-java/2.3.0 okhttp/4.12.0',
    headers: {
      'user-agent': 'zhipuai-sdk-java/2.3.0 okhttp/4.12.0',
      'x-request-sdk': 'zhipuai-sdk-java/2.3.0',
      'accept-language': 'zh-CN,zh;q=0.9,en-US;q=0.8',
    },
  },
  {
    label: 'python-httpx/0.28.1 (Linux aarch64 • Py 3.13)',
    userAgent: 'python-httpx/0.28.1',
    headers: {
      'user-agent': 'python-httpx/0.28.1',
      'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8',
    },
  },
];

function fnv1aHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Resolve the isolated SDK Fingerprint Persona for a specific `provider_connections` row.
 * Uses explicit `personaSlot` in `metadata_json` if present (assigned sequentially per provider),
 * or falls back to a deterministic FNV-1a hash of `connectionId:provider`.
 */
export function resolveAccountSdkPersona(
  connectionId: string,
  provider: string,
  metadataJson?: string | null
): SdkFingerprintPersona {
  let slot: number | null = null;
  if (metadataJson) {
    try {
      const parsed = JSON.parse(metadataJson) as { personaSlot?: unknown };
      if (typeof parsed.personaSlot === 'number' && Number.isFinite(parsed.personaSlot)) {
        slot = Math.abs(Math.trunc(parsed.personaSlot)) % SDK_FINGERPRINT_POOL.length;
      }
    } catch {
      // ignore invalid JSON
    }
  }
  if (slot === null) {
    slot = fnv1aHash(`${connectionId}:${provider}`) % SDK_FINGERPRINT_POOL.length;
  }
  const base = SDK_FINGERPRINT_POOL[slot];
  return {
    slot,
    label: base.label,
    userAgent: base.userAgent,
    headers: { ...base.headers },
  };
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

  const persona = resolveAccountSdkPersona(
    connection.id,
    connection.provider,
    connection.metadataJson
  );

  let url = `${baseUrl}/chat/completions`;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: req.stream ? 'text/event-stream' : 'application/json',
    ...persona.headers,
    ...(creds.extraHeaders ?? {}),
  };

  // Strip any proxy-identifying headers so each account appears as a direct SDK client
  delete headers['x-forwarded-for'];
  delete headers['x-real-ip'];
  delete headers['cf-connecting-ip'];
  delete headers['via'];

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
