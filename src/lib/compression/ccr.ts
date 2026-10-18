import type { KVNamespace } from '../../types/env';
import { sha256Hex } from '../crypto';

export interface CcrArchiveEntry {
  id: string;
  originalLength: number;
  summary: string;
  content: string;
  createdAt: number;
}

const CCR_MIN_CHAR_THRESHOLD = 1400;
const CCR_TTL_SECONDS = 3600; // 1 hour in Cloudflare KV

/**
 * Archive a large tool output or log block to Cloudflare KV (`FLAREROUTE_KV`)
 * and return a compact summary + `[CCR:<id>]` marker.
 */
export async function archiveToCcr(
  kv: KVNamespace,
  content: string
): Promise<{ replaced: boolean; replacementText: string; ccrId?: string }> {
  if (content.length < CCR_MIN_CHAR_THRESHOLD) {
    return { replaced: false, replacementText: content };
  }

  const hash = (await sha256Hex(content)).slice(0, 12);
  const ccrId = `ccr_${hash}`;
  const lines = content.split('\n');
  const headPreview = lines.slice(0, 6).join('\n').slice(0, 320);
  const tailPreview = lines.length > 10 ? lines.slice(-4).join('\n').slice(0, 220) : '';

  const summary = [
    `[CCR:${ccrId} | Archived ${content.length} chars (${lines.length} lines) to FlareRoute KV (TTL 1h)]`,
    `--- HEAD PREVIEW ---`,
    headPreview,
    ...(tailPreview ? [`--- TAIL PREVIEW ---`, tailPreview] : []),
    `[To inspect full original content, reference marker [CCR:${ccrId}] or call tool recall_ccr("${ccrId}")]`,
  ].join('\n');

  const record: CcrArchiveEntry = {
    id: ccrId,
    originalLength: content.length,
    summary,
    content,
    createdAt: Date.now(),
  };

  await kv.put(`ccr:block:${ccrId}`, JSON.stringify(record), {
    expirationTtl: CCR_TTL_SECONDS,
  });

  return {
    replaced: true,
    replacementText: summary,
    ccrId,
  };
}

/**
 * Retrieve an archived CCR block by ID from Cloudflare KV
 */
export async function retrieveFromCcr(
  kv: KVNamespace,
  ccrId: string
): Promise<CcrArchiveEntry | null> {
  const cleanId = ccrId.replace(/^\[CCR:|\]$/g, '').trim();
  return kv.get<CcrArchiveEntry>(`ccr:block:${cleanId}`, 'json');
}
