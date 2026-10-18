import type {
  CanonicalMessage,
  CanonicalRequest,
  CanonicalResponse,
  CanonicalStreamChunk,
  CanonicalTool,
  CanonicalToolCall,
} from './types';

/**
 * Parse inbound Anthropic `/v1/messages` JSON body (Claude Code compatible) into `CanonicalRequest`
 */
export function parseAnthropicMessagesRequest(body: Record<string, unknown>): CanonicalRequest {
  const model = typeof body.model === 'string' ? body.model : 'auto/coding';
  const stream = Boolean(body.stream);

  let systemPrompt: string | undefined;
  let systemCacheControl: { type: 'ephemeral' } | null = null;

  if (typeof body.system === 'string') {
    systemPrompt = body.system;
  } else if (Array.isArray(body.system)) {
    const sysParts: string[] = [];
    for (const part of body.system) {
      if (part && typeof part === 'object') {
        const p = part as Record<string, unknown>;
        if (typeof p.text === 'string') sysParts.push(p.text);
        if (p.cache_control && typeof p.cache_control === 'object') {
          systemCacheControl = { type: 'ephemeral' };
        }
      }
    }
    systemPrompt = sysParts.join('\n\n');
  }

  const messages: CanonicalMessage[] = [];
  const rawMessages = Array.isArray(body.messages) ? body.messages : [];

  for (const rawMsg of rawMessages) {
    if (!rawMsg || typeof rawMsg !== 'object') continue;
    const msg = rawMsg as Record<string, unknown>;
    const role = msg.role === 'assistant' ? 'assistant' : 'user';

    if (typeof msg.content === 'string') {
      messages.push({ role, content: msg.content });
      continue;
    }

    if (Array.isArray(msg.content)) {
      const textParts: string[] = [];
      let thinkingText: string | undefined;
      let thinkingSignature: string | undefined;
      const toolCalls: CanonicalToolCall[] = [];
      let msgCacheControl: { type: 'ephemeral' } | null = null;

      for (const block of msg.content) {
        if (!block || typeof block !== 'object') continue;
        const b = block as Record<string, unknown>;
        if (b.cache_control) {
          msgCacheControl = { type: 'ephemeral' };
        }
        if (b.type === 'text' && typeof b.text === 'string') {
          textParts.push(b.text);
        } else if (b.type === 'thinking' && typeof b.thinking === 'string') {
          thinkingText = b.thinking;
          thinkingSignature = typeof b.signature === 'string' ? b.signature : undefined;
        } else if (b.type === 'tool_use') {
          toolCalls.push({
            id: typeof b.id === 'string' ? b.id : `toolu_${crypto.randomUUID().slice(0, 12)}`,
            name: typeof b.name === 'string' ? b.name : 'tool',
            argumentsJson: JSON.stringify(b.input ?? {}),
          });
        } else if (b.type === 'tool_result') {
          const resultContent =
            typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? '');
          messages.push({
            role: 'tool',
            content: resultContent,
            toolCallId: typeof b.tool_use_id === 'string' ? b.tool_use_id : 'toolu_0',
            cacheControl: msgCacheControl,
          });
        }
      }

      if (textParts.length > 0 || thinkingText || toolCalls.length > 0) {
        messages.push({
          role,
          content: textParts.join('\n'),
          thinking: thinkingText,
          thinkingSignature,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          cacheControl: msgCacheControl,
        });
      }
    }
  }

  let tools: CanonicalTool[] | undefined;
  if (Array.isArray(body.tools)) {
    tools = body.tools
      .filter((t): t is Record<string, unknown> => Boolean(t && typeof t === 'object'))
      .map((t) => ({
        name: typeof t.name === 'string' ? t.name : 'tool',
        description: typeof t.description === 'string' ? t.description : undefined,
        parameters:
          t.input_schema && typeof t.input_schema === 'object'
            ? (t.input_schema as Record<string, unknown>)
            : { type: 'object', properties: {} },
      }));
  }

  let thinkingBudgetTokens: number | undefined;
  if (body.thinking && typeof body.thinking === 'object') {
    const th = body.thinking as Record<string, unknown>;
    if (th.type === 'enabled' && typeof th.budget_tokens === 'number') {
      thinkingBudgetTokens = th.budget_tokens;
    }
  }

  return {
    model,
    messages,
    systemPrompt,
    systemCacheControl,
    stream,
    temperature: typeof body.temperature === 'number' ? body.temperature : undefined,
    maxTokens: typeof body.max_tokens === 'number' ? body.max_tokens : 8192,
    topP: typeof body.top_p === 'number' ? body.top_p : undefined,
    tools,
    toolChoice: body.tool_choice,
    thinkingBudgetTokens,
    inboundProtocol: 'anthropic-messages',
  };
}

/**
 * Build upstream Anthropic `/v1/messages` request payload from `CanonicalRequest`,
 * preserving `cache_control: { type: 'ephemeral' }` markers and `thinking` blocks.
 */
export function buildAnthropicMessagesUpstreamBody(
  req: CanonicalRequest,
  targetModel: string
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model: targetModel,
    max_tokens: req.maxTokens ?? 8192,
    stream: req.stream,
  };

  if (req.systemPrompt) {
    payload.system = [
      {
        type: 'text',
        text: req.systemPrompt,
        ...(req.systemCacheControl ? { cache_control: { type: 'ephemeral' } } : {}),
      },
    ];
  }

  const anthropicMessages: Array<Record<string, unknown>> = [];
  for (const m of req.messages) {
    if (m.role === 'tool') {
      anthropicMessages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: m.toolCallId ?? 'toolu_0',
            content: m.content,
            ...(m.cacheControl ? { cache_control: { type: 'ephemeral' } } : {}),
          },
        ],
      });
      continue;
    }

    const contentBlocks: Array<Record<string, unknown>> = [];
    if (m.thinking) {
      contentBlocks.push({
        type: 'thinking',
        thinking: m.thinking,
        ...(m.thinkingSignature ? { signature: m.thinkingSignature } : {}),
      });
    }
    if (m.content) {
      contentBlocks.push({
        type: 'text',
        text: m.content,
        ...(m.cacheControl ? { cache_control: { type: 'ephemeral' } } : {}),
      });
    }
    if (m.toolCalls && m.toolCalls.length > 0) {
      for (const tc of m.toolCalls) {
        let parsedInput: unknown = {};
        try {
          parsedInput = JSON.parse(tc.argumentsJson);
        } catch {
          parsedInput = {};
        }
        contentBlocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          input: parsedInput,
        });
      }
    }

    if (contentBlocks.length > 0) {
      anthropicMessages.push({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: contentBlocks,
      });
    }
  }

  payload.messages = anthropicMessages;

  if (req.thinkingBudgetTokens && req.thinkingBudgetTokens > 0) {
    payload.thinking = {
      type: 'enabled',
      budget_tokens: req.thinkingBudgetTokens,
    };
  } else if (req.temperature !== undefined) {
    payload.temperature = req.temperature;
  }

  if (req.tools && req.tools.length > 0) {
    payload.tools = req.tools.map((t) => ({
      name: t.name,
      description: t.description ?? '',
      input_schema: t.parameters,
    }));
  }

  return payload;
}

/**
 * Parse a non-streaming Anthropic `/v1/messages` JSON response into `CanonicalResponse`
 */
export function parseAnthropicMessagesResponse(
  raw: Record<string, unknown>,
  fallbackModel: string
): CanonicalResponse {
  const contentBlocks = Array.isArray(raw.content) ? raw.content : [];
  const textParts: string[] = [];
  let thinking: string | undefined;
  const toolCalls: CanonicalToolCall[] = [];

  for (const block of contentBlocks) {
    if (!block || typeof block !== 'object') continue;
    const b = block as Record<string, unknown>;
    if (b.type === 'text' && typeof b.text === 'string') {
      textParts.push(b.text);
    } else if (b.type === 'thinking' && typeof b.thinking === 'string') {
      thinking = b.thinking;
    } else if (b.type === 'tool_use') {
      toolCalls.push({
        id: typeof b.id === 'string' ? b.id : `toolu_${crypto.randomUUID().slice(0, 10)}`,
        name: typeof b.name === 'string' ? b.name : 'tool',
        argumentsJson: JSON.stringify(b.input ?? {}),
      });
    }
  }

  const usageObj =
    raw.usage && typeof raw.usage === 'object' ? (raw.usage as Record<string, unknown>) : {};
  const promptTokens = typeof usageObj.input_tokens === 'number' ? usageObj.input_tokens : 0;
  const completionTokens = typeof usageObj.output_tokens === 'number' ? usageObj.output_tokens : 0;
  const cachedTokens =
    typeof usageObj.cache_read_input_tokens === 'number' ? usageObj.cache_read_input_tokens : 0;

  return {
    id: typeof raw.id === 'string' ? raw.id : `msg_${crypto.randomUUID().slice(0, 20)}`,
    model: typeof raw.model === 'string' ? raw.model : fallbackModel,
    content: textParts.join('\n'),
    thinking,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    finishReason:
      toolCalls.length > 0
        ? 'tool_calls'
        : raw.stop_reason === 'max_tokens'
          ? 'length'
          : 'end_turn',
    usage: {
      promptTokens,
      completionTokens,
      cachedTokens,
      totalTokens: promptTokens + completionTokens,
    },
  };
}

/**
 * Format `CanonicalResponse` into Anthropic `/v1/messages` JSON response (Claude Code compatible)
 */
export function formatAnthropicMessagesResponse(resp: CanonicalResponse): Record<string, unknown> {
  const content: Array<Record<string, unknown>> = [];

  if (resp.thinking) {
    content.push({
      type: 'thinking',
      thinking: resp.thinking,
      signature: 'flareroute-verified-thinking-sig',
    });
  }

  if (resp.content || (!resp.toolCalls || resp.toolCalls.length === 0)) {
    content.push({
      type: 'text',
      text: resp.content,
    });
  }

  if (resp.toolCalls && resp.toolCalls.length > 0) {
    for (const tc of resp.toolCalls) {
      let parsedInput: unknown = {};
      try {
        parsedInput = JSON.parse(tc.argumentsJson);
      } catch {
        parsedInput = {};
      }
      content.push({
        type: 'tool_use',
        id: tc.id.startsWith('toolu_') ? tc.id : `toolu_${tc.id}`,
        name: tc.name,
        input: parsedInput,
      });
    }
  }

  return {
    id: resp.id.startsWith('msg_') ? resp.id : `msg_${resp.id}`,
    type: 'message',
    role: 'assistant',
    model: resp.model,
    content,
    stop_reason:
      resp.toolCalls && resp.toolCalls.length > 0
        ? 'tool_use'
        : resp.finishReason === 'length'
          ? 'max_tokens'
          : 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: resp.usage.promptTokens,
      output_tokens: resp.usage.completionTokens,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: resp.usage.cachedTokens,
    },
  };
}

/**
 * Create a Web `TransformStream` that converts `CanonicalStreamChunk` into Anthropic `/v1/messages`
 * SSE stream (`message_start`, `content_block_start`, `content_block_delta`, `content_block_stop`, `message_delta`, `message_stop`).
 */
export function createCanonicalToAnthropicStream(
  model: string,
  sanitizeText: (text: string) => string
): TransformStream<CanonicalStreamChunk, Uint8Array> {
  const encoder = new TextEncoder();
  const msgId = `msg_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
  let currentBlockType: 'none' | 'thinking' | 'text' | 'tool' = 'none';
  let blockIndex = -1;

  const emitSse = (
    controller: TransformStreamDefaultController<Uint8Array>,
    event: string,
    data: Record<string, unknown>
  ): void => {
    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
  };

  return new TransformStream<CanonicalStreamChunk, Uint8Array>({
    transform(chunk, controller) {
      if (chunk.type === 'start') {
        emitSse(controller, 'message_start', {
          type: 'message_start',
          message: {
            id: msgId,
            type: 'message',
            role: 'assistant',
            model: chunk.model ?? model,
            content: [],
            stop_reason: null,
            stop_sequence: null,
            usage: {
              input_tokens: chunk.promptTokens ?? 0,
              output_tokens: 0,
              cache_read_input_tokens: chunk.cachedTokens ?? 0,
            },
          },
        });
        return;
      }

      if (chunk.type === 'thinking_delta' && chunk.thinkingDelta) {
        if (currentBlockType !== 'thinking') {
          if (currentBlockType !== 'none') {
            emitSse(controller, 'content_block_stop', {
              type: 'content_block_stop',
              index: blockIndex,
            });
          }
          blockIndex += 1;
          currentBlockType = 'thinking';
          emitSse(controller, 'content_block_start', {
            type: 'content_block_start',
            index: blockIndex,
            content_block: { type: 'thinking', thinking: '' },
          });
        }
        emitSse(controller, 'content_block_delta', {
          type: 'content_block_delta',
          index: blockIndex,
          delta: {
            type: 'thinking_delta',
            thinking: sanitizeText(chunk.thinkingDelta),
          },
        });
        return;
      }

      if (chunk.type === 'text_delta' && chunk.textDelta) {
        if (currentBlockType !== 'text') {
          if (currentBlockType !== 'none') {
            emitSse(controller, 'content_block_stop', {
              type: 'content_block_stop',
              index: blockIndex,
            });
          }
          blockIndex += 1;
          currentBlockType = 'text';
          emitSse(controller, 'content_block_start', {
            type: 'content_block_start',
            index: blockIndex,
            content_block: { type: 'text', text: '' },
          });
        }
        emitSse(controller, 'content_block_delta', {
          type: 'content_block_delta',
          index: blockIndex,
          delta: {
            type: 'text_delta',
            text: sanitizeText(chunk.textDelta),
          },
        });
        return;
      }

      if (chunk.type === 'tool_call_delta') {
        if (currentBlockType !== 'tool') {
          if (currentBlockType !== 'none') {
            emitSse(controller, 'content_block_stop', {
              type: 'content_block_stop',
              index: blockIndex,
            });
          }
          blockIndex += 1;
          currentBlockType = 'tool';
          emitSse(controller, 'content_block_start', {
            type: 'content_block_start',
            index: blockIndex,
            content_block: {
              type: 'tool_use',
              id: chunk.toolCallId ?? `toolu_${blockIndex}`,
              name: chunk.toolName ?? 'tool',
              input: {},
            },
          });
        }
        if (chunk.toolArgumentsDelta) {
          emitSse(controller, 'content_block_delta', {
            type: 'content_block_delta',
            index: blockIndex,
            delta: {
              type: 'input_json_delta',
              partial_json: chunk.toolArgumentsDelta,
            },
          });
        }
        return;
      }

      if (chunk.type === 'done') {
        if (currentBlockType !== 'none') {
          emitSse(controller, 'content_block_stop', {
            type: 'content_block_stop',
            index: blockIndex,
          });
        }
        emitSse(controller, 'message_delta', {
          type: 'message_delta',
          delta: {
            stop_reason: chunk.finishReason === 'tool_calls' ? 'tool_use' : 'end_turn',
            stop_sequence: null,
          },
          usage: {
            output_tokens: chunk.completionTokens ?? 0,
          },
        });
        emitSse(controller, 'message_stop', { type: 'message_stop' });
      }
    },
  });
}
