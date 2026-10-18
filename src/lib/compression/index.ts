import type {
  CompressionLayer,
  CompressionProfile,
  KVNamespace,
} from '../../types/env';
import type { CanonicalMessage, CanonicalRequest } from '../../sse/translators/types';
import {
  applyLayer1SessionDedup,
  applyLayer2Ccr,
  applyLayer3Lite,
  applyLayer4RtkCliCompactor,
  applyLayer5ResponsesToolOutput,
  applyLayer6HeadroomTabularCodec,
  applyLayer7Relevance,
  applyLayer8Caveman,
  applyLayer9Aggressive,
  applyLayer10Ultra,
} from './layers';

export interface CompressionStats {
  originalTokens: number;
  compressedTokens: number;
  tokensSaved: number;
  savingsPercent: number;
  layersApplied: CompressionLayer[];
  ccrArchivedIds: string[];
}

/**
 * Fast, deterministic BPE-like token estimator (~3.85 chars per token for English + code)
 */
export function estimateTokensFromText(text: string): number {
  if (!text) return 0;
  const codeWeight = (text.match(/[{}()[\];.,:=<>+\-*/\\|&^%$#@!~`]/g) ?? []).length;
  const baseTokens = Math.ceil(text.length / 3.85);
  return baseTokens + Math.floor(codeWeight * 0.12);
}

export function estimateRequestTokens(
  messages: CanonicalMessage[],
  systemPrompt?: string
): number {
  let total = systemPrompt ? estimateTokensFromText(systemPrompt) + 4 : 0;
  for (const m of messages) {
    total += estimateTokensFromText(m.content) + 4;
    if (m.thinking) total += estimateTokensFromText(m.thinking);
    if (m.toolCalls) {
      for (const tc of m.toolCalls) {
        total += estimateTokensFromText(tc.name) + estimateTokensFromText(tc.argumentsJson) + 6;
      }
    }
  }
  return Math.max(1, total);
}

/**
 * Resolve which of the 10 compression layers are active for a given profile
 */
export function resolveActiveCompressionLayers(
  profile: CompressionProfile | string,
  customLayers?: CompressionLayer[]
): CompressionLayer[] {
  switch (profile) {
    case 'off':
      return [];
    case 'lite':
      return ['lite', 'rtk', 'headroom'];
    case 'balanced':
      return [
        'session-dedup',
        'ccr',
        'lite',
        'rtk',
        'responses-tool',
        'headroom',
      ];
    case 'aggressive':
      return [
        'session-dedup',
        'ccr',
        'lite',
        'rtk',
        'responses-tool',
        'headroom',
        'relevance',
        'caveman',
        'aggressive',
      ];
    case 'ultra':
      return [
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
      ];
    case 'custom':
      return customLayers && customLayers.length > 0
        ? customLayers
        : ['session-dedup', 'ccr', 'lite', 'rtk', 'headroom'];
    default:
      return ['session-dedup', 'ccr', 'lite', 'rtk', 'responses-tool', 'headroom'];
  }
}

/**
 * Execute the 10-Layer Pure-TypeScript Token Compression Pipeline on a `CanonicalRequest`.
 */
export async function runTokenCompressionPipeline(
  req: CanonicalRequest,
  kv: KVNamespace | null,
  profile: CompressionProfile | string = 'balanced',
  customLayers?: CompressionLayer[]
): Promise<{
  request: CanonicalRequest;
  stats: CompressionStats;
}> {
  const originalTokens = estimateRequestTokens(req.messages, req.systemPrompt);
  const layers = resolveActiveCompressionLayers(profile, customLayers);

  if (layers.length === 0) {
    return {
      request: req,
      stats: {
        originalTokens,
        compressedTokens: originalTokens,
        tokensSaved: 0,
        savingsPercent: 0,
        layersApplied: [],
        ccrArchivedIds: [],
      },
    };
  }

  let messages: CanonicalMessage[] = req.messages.map((m) => ({ ...m }));
  let systemPrompt = req.systemPrompt;
  const appliedLayers: CompressionLayer[] = [];
  let ccrArchivedIds: string[] = [];

  // Layer 1: Session-Dedup
  if (layers.includes('session-dedup')) {
    messages = await applyLayer1SessionDedup(messages, kv, req.sessionId ?? 'global');
    appliedLayers.push('session-dedup');
  }

  // Layer 2: CCR (Context Control & Recovery via Cloudflare KV)
  if (layers.includes('ccr')) {
    const ccrRes = await applyLayer2Ccr(messages, kv);
    messages = ccrRes.messages;
    ccrArchivedIds = ccrRes.archivedIds;
    appliedLayers.push('ccr');

    if (ccrArchivedIds.length > 0) {
      const ccrInstruction = `\n[FlareRoute CCR Active: Large context blocks were archived to KV with IDs ${ccrArchivedIds.join(
        ', '
      )}. If you need the full original text of any [CCR:id] block, request it or call recall_ccr.]`;
      systemPrompt = systemPrompt ? `${systemPrompt}${ccrInstruction}` : ccrInstruction.trim();
    }
  }

  // Layer 3: Lite
  if (layers.includes('lite')) {
    messages = messages.map((m) => ({ ...m, content: applyLayer3Lite(m.content) }));
    if (systemPrompt) systemPrompt = applyLayer3Lite(systemPrompt);
    appliedLayers.push('lite');
  }

  // Layer 4: RTK (CLI Output Compactor)
  if (layers.includes('rtk')) {
    messages = messages.map((m) => ({ ...m, content: applyLayer4RtkCliCompactor(m.content) }));
    appliedLayers.push('rtk');
  }

  // Layer 5: Responses Tool Output
  if (layers.includes('responses-tool')) {
    messages = messages.map((m) => ({
      ...m,
      content: applyLayer5ResponsesToolOutput(m.content),
    }));
    appliedLayers.push('responses-tool');
  }

  // Layer 6: Headroom (Pure-TS Lossless Tabular Codec)
  if (layers.includes('headroom')) {
    messages = messages.map((m) => ({
      ...m,
      content: applyLayer6HeadroomTabularCodec(m.content),
    }));
    if (systemPrompt) systemPrompt = applyLayer6HeadroomTabularCodec(systemPrompt);
    appliedLayers.push('headroom');
  }

  // Layer 7: Relevance
  if (layers.includes('relevance')) {
    messages = applyLayer7Relevance(messages);
    appliedLayers.push('relevance');
  }

  // Layer 8: Caveman
  if (layers.includes('caveman')) {
    messages = messages.map((m) => ({ ...m, content: applyLayer8Caveman(m.content) }));
    appliedLayers.push('caveman');
  }

  // Layer 9: Aggressive
  if (layers.includes('aggressive')) {
    messages = applyLayer9Aggressive(messages);
    appliedLayers.push('aggressive');
  }

  // Layer 10: Ultra
  if (layers.includes('ultra')) {
    messages = applyLayer10Ultra(messages);
    appliedLayers.push('ultra');
  }

  const compressedTokens = estimateRequestTokens(messages, systemPrompt);
  const tokensSaved = Math.max(0, originalTokens - compressedTokens);
  const savingsPercent =
    originalTokens > 0 ? Number(((tokensSaved / originalTokens) * 100).toFixed(1)) : 0;

  return {
    request: {
      ...req,
      messages,
      systemPrompt,
    },
    stats: {
      originalTokens,
      compressedTokens,
      tokensSaved,
      savingsPercent,
      layersApplied: appliedLayers,
      ccrArchivedIds,
    },
  };
}
