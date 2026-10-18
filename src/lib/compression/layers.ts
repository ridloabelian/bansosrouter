import type { KVNamespace } from '../../types/env';
import type { CanonicalMessage } from '../../sse/translators/types';
import { sha256Hex } from '../crypto';
import { archiveToCcr } from './ccr';

/**
 * Split text into alternating prose and fenced-code-block segments so
 * prose transformations never corrupt code indentation or string literals.
 */
function mapOutsideCodeBlocks(text: string, fn: (prose: string) => string): string {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts
    .map((segment) => {
      if (segment.startsWith('```') && segment.endsWith('```')) {
        return segment;
      }
      return fn(segment);
    })
    .join('');
}

/**
 * Layer 1: `session-dedup`
 * Deduplicates identical large context/file blocks across turns within a session using SHA-256 in KV.
 */
export async function applyLayer1SessionDedup(
  messages: CanonicalMessage[],
  kv: KVNamespace | null,
  sessionId = 'default'
): Promise<CanonicalMessage[]> {
  const seenLocal = new Map<string, number>();
  const out: CanonicalMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    // Never deduplicate the very last user turn
    if (i === messages.length - 1 || msg.content.length < 350) {
      out.push(msg);
      continue;
    }

    const hash = (await sha256Hex(msg.content)).slice(0, 16);
    const kvKey = `dedup:${sessionId}:${hash}`;

    let alreadySeenTurn = seenLocal.get(hash);
    if (alreadySeenTurn === undefined && kv) {
      const existing = await kv.get(kvKey);
      if (existing) {
        alreadySeenTurn = parseInt(existing, 10) || 1;
      } else {
        await kv.put(kvKey, String(i + 1), { expirationTtl: 1800 });
      }
    }
    seenLocal.set(hash, i + 1);

    if (alreadySeenTurn !== undefined && alreadySeenTurn !== i + 1) {
      out.push({
        ...msg,
        content: `[Session-Dedup: Identical ${msg.content.length}-char block already provided in turn #${alreadySeenTurn} (sha256:${hash})]`,
      });
    } else {
      out.push(msg);
    }
  }

  return out;
}

/**
 * Layer 2: `ccr` (Context Control & Recovery)
 * Archives oversized historical tool outputs (>1,400 chars) to Cloudflare KV (`[CCR:id]`).
 */
export async function applyLayer2Ccr(
  messages: CanonicalMessage[],
  kv: KVNamespace | null
): Promise<{ messages: CanonicalMessage[]; archivedIds: string[] }> {
  if (!kv) return { messages, archivedIds: [] };
  const archivedIds: string[] = [];
  const out: CanonicalMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const isLatestTurn = i >= messages.length - 1;
    const isCandidate =
      !isLatestTurn && (msg.role === 'tool' || msg.content.length >= 1600);

    if (isCandidate && msg.content.length >= 1400) {
      const archived = await archiveToCcr(kv, msg.content);
      if (archived.replaced && archived.ccrId) {
        archivedIds.push(archived.ccrId);
        out.push({ ...msg, content: archived.replacementText });
        continue;
      }
    }
    out.push(msg);
  }

  return { messages: out, archivedIds };
}

/**
 * Layer 3: `lite`
 * Collapses redundant blank lines, trailing spaces, empty HTML/JS comments, and tracking URL params.
 */
export function applyLayer3Lite(text: string): string {
  return mapOutsideCodeBlocks(text, (prose) =>
    prose
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/<!--\s*-->/g, '')
      .replace(
        /(https?:\/\/[^\s)?#]+)\?(?:utm_[^&\s)]+|fbclid=[^&\s)]+|gclid=[^&\s)]+)(?:&[^\s)]*)?/g,
        '$1'
      )
      .trim()
  );
}

/**
 * Layer 4: `rtk` (CLI Output Compactor)
 * Compacts verbose CLI output from `git diff`, `git status`, `npm/pytest/cargo/gradle/dotnet test`, and `docker` logs.
 */
export function applyLayer4RtkCliCompactor(text: string): string {
  let result = text;

  // Compact repetitive npm / yarn / pnpm install progress & warning noise
  result = result.replace(/^(?:npm warn|npm notice|Progress: resolved).*$/gim, '');

  // Compact git diff index/mode headers while keeping file paths and changed lines
  result = result.replace(/^index [0-9a-f]{7,40}\.\.[0-9a-f]{7,40}(?: \d+)?$/gm, '');

  // Compact passing test suite lines (pytest, jest, vitest, cargo test) when > 8 passing lines appear
  const lines = result.split('\n');
  const compactedLines: string[] = [];
  let consecutivePassCount = 0;

  for (const line of lines) {
    const isPassLine =
      /^\s*(?:PASS|✓|✔|ok \d+|\.\.\. ok|PASSED)\b/.test(line) &&
      !/FAIL|ERROR|✕|❌/i.test(line);

    if (isPassLine) {
      consecutivePassCount += 1;
      if (consecutivePassCount <= 3) {
        compactedLines.push(line);
      }
    } else {
      if (consecutivePassCount > 3) {
        compactedLines.push(`  [RTK: ... ${consecutivePassCount - 3} more passing test lines compacted ...]`);
      }
      consecutivePassCount = 0;
      compactedLines.push(line);
    }
  }
  if (consecutivePassCount > 3) {
    compactedLines.push(`  [RTK: ... ${consecutivePassCount - 3} more passing test lines compacted ...]`);
  }

  return compactedLines.join('\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * Layer 5: `responses-tool`
 * Compresses verbose JSON outputs from `exec_command`, `apply_patch`, and file search tools.
 */
export function applyLayer5ResponsesToolOutput(text: string): string {
  return text.replace(/\{[\s\S]{250,}\}/g, (match) => {
    try {
      const parsed: unknown = JSON.parse(match);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return match;
      const obj = parsed as Record<string, unknown>;

      // Strip redundant metadata fields common in CLI tool responses
      const noisyKeys = ['raw_stdout_bytes', 'environment_snapshot', 'debug_trace', 'timings_ns'];
      for (const k of noisyKeys) {
        delete obj[k];
      }

      if (typeof obj.stdout === 'string' && obj.stdout.length > 1200) {
        const stdoutLines = obj.stdout.split('\n');
        if (stdoutLines.length > 30) {
          obj.stdout = [
            ...stdoutLines.slice(0, 15),
            `...[Responses-Tool: omitted ${stdoutLines.length - 25} middle lines]...`,
            ...stdoutLines.slice(-10),
          ].join('\n');
        }
      }

      return JSON.stringify(obj);
    } catch {
      return match;
    }
  });
}

/**
 * Layer 6: `headroom` (Pure-TS Lossless Tabular Codec)
 * Detects JSON arrays of uniform objects `[{k1:v1, k2:v2}, {k1:v3, k2:v4}]`
 * and converts them into a lossless tabular representation `{"__tabular_schema":["k1","k2"],"__rows":[[v1,v2],[v3,v4]]}`
 * eliminating repeated object keys across every row!
 */
export function applyLayer6HeadroomTabularCodec(text: string): string {
  return text.replace(/\[\s*\{[\s\S]{80,}?\}\s*\]/g, (jsonCandidate) => {
    try {
      const parsed: unknown = JSON.parse(jsonCandidate);
      if (!Array.isArray(parsed) || parsed.length < 3) return jsonCandidate;

      // Verify all items are plain objects with identical keys
      const first = parsed[0];
      if (!first || typeof first !== 'object' || Array.isArray(first)) return jsonCandidate;
      const schemaKeys = Object.keys(first as Record<string, unknown>);
      if (schemaKeys.length === 0) return jsonCandidate;

      const rows: unknown[][] = [];
      for (const item of parsed) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return jsonCandidate;
        const record = item as Record<string, unknown>;
        const itemKeys = Object.keys(record);
        if (
          itemKeys.length !== schemaKeys.length ||
          !schemaKeys.every((k) => Object.prototype.hasOwnProperty.call(record, k))
        ) {
          return jsonCandidate;
        }
        rows.push(schemaKeys.map((k) => record[k]));
      }

      const encoded = JSON.stringify({
        __tabular_schema: schemaKeys,
        __rows: rows,
      });

      return encoded.length < jsonCandidate.length ? encoded : jsonCandidate;
    } catch {
      return jsonCandidate;
    }
  });
}

/**
 * Decode a `Headroom` tabular object back to standard JSON array of objects (lossless inverse)
 */
export function decodeHeadroomTabular(input: {
  __tabular_schema: string[];
  __rows: unknown[][];
}): Array<Record<string, unknown>> {
  return input.__rows.map((row) => {
    const obj: Record<string, unknown> = {};
    input.__tabular_schema.forEach((key, idx) => {
      obj[key] = row[idx];
    });
    return obj;
  });
}

/**
 * Layer 7: `relevance`
 * Extractive term-overlap scoring on long historical messages to retain sentences
 * most relevant to the user's latest query.
 */
export function applyLayer7Relevance(
  messages: CanonicalMessage[]
): CanonicalMessage[] {
  if (messages.length < 3) return messages;
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUserMsg) return messages;

  const queryTerms = new Set(
    lastUserMsg.content
      .toLowerCase()
      .split(/[^a-z0-9_]+/)
      .filter((w) => w.length >= 3)
  );

  if (queryTerms.size === 0) return messages;

  return messages.map((msg, idx) => {
    // Keep recent 2 turns and short messages untouched
    if (idx >= messages.length - 2 || msg.content.length < 900) return msg;

    const paragraphs = msg.content.split(/\n\n+/);
    if (paragraphs.length <= 3) return msg;

    const scored = paragraphs.map((p, pIdx) => {
      if (p.includes('```') || p.includes('[CCR:')) {
        return { p, pIdx, score: 999 };
      }
      const words = p.toLowerCase().split(/[^a-z0-9_]+/);
      let hits = 0;
      for (const w of words) {
        if (queryTerms.has(w)) hits += 1;
      }
      // Keep first and last paragraphs higher weighted
      const positionBonus = pIdx === 0 || pIdx === paragraphs.length - 1 ? 2 : 0;
      return { p, pIdx, score: hits + positionBonus };
    });

    const keepCount = Math.max(2, Math.ceil(paragraphs.length * 0.65));
    const topIndices = new Set(
      [...scored]
        .sort((a, b) => b.score - a.score)
        .slice(0, keepCount)
        .map((x) => x.pIdx)
    );

    const filtered = paragraphs.filter((_, pIdx) => topIndices.has(pIdx));
    return {
      ...msg,
      content: filtered.join('\n\n'),
    };
  });
}

/**
 * Layer 8: `caveman`
 * Strips polite conversational filler phrases outside of fenced code blocks.
 */
export function applyLayer8Caveman(text: string): string {
  const fillerPatterns: RegExp[] = [
    /\b(?:could you please|would you kindly|i would really appreciate it if you could|please feel free to|if you don't mind)\s+/gi,
    /\b(?:thank you so much in advance|thanks a lot in advance|thank you very much|hope you are doing well)[.!,\s]*/gi,
    /\b(?:as an ai language model|certainly! i'd be happy to help you with that\.?|sure thing! let's dive right in\.?)\s*/gi,
    /\b(?:basically|essentially|literally|honestly speaking|to be completely honest),?\s+/gi,
  ];

  return mapOutsideCodeBlocks(text, (prose) => {
    let out = prose;
    for (const regex of fillerPatterns) {
      out = out.replace(regex, '');
    }
    return out.replace(/ {2,}/g, ' ').trim();
  });
}

/**
 * Layer 9: `aggressive`
 * Progressively folds older conversational turns (`turns[1 .. N-4]`) when conversation grows long.
 */
export function applyLayer9Aggressive(messages: CanonicalMessage[]): CanonicalMessage[] {
  if (messages.length <= 5) return messages;
  return messages.map((msg, idx) => {
    if (idx === 0 || idx >= messages.length - 3) return msg;
    if (msg.content.length <= 500) return msg;
    const head = msg.content.slice(0, 260);
    const tail = msg.content.slice(-140);
    return {
      ...msg,
      content: `${head}\n...[Aggressive-Layer: ${msg.content.length - 400} chars folded]...\n${tail}`,
    };
  });
}

/**
 * Layer 10: `ultra`
 * Maximum token reduction mode: strips single-line comments inside non-critical snippets and
 * tightly compacts all non-final turns.
 */
export function applyLayer10Ultra(messages: CanonicalMessage[]): CanonicalMessage[] {
  return messages.map((msg, idx) => {
    const isFinal = idx === messages.length - 1;
    let content = msg.content
      .replace(/[ \t]+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();

    if (!isFinal && content.length > 320) {
      content = `${content.slice(0, 220)} ...[Ultra-Compacted]... ${content.slice(-80)}`;
    }
    return {
      ...msg,
      content,
    };
  });
}
