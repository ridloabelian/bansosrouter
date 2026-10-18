import type {
  CanonicalMessage,
  CanonicalRequest,
  CanonicalResponse,
  CanonicalStreamChunk,
  CanonicalTool,
  CanonicalToolCall,
} from './types';

function extractTextFromContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          const obj = part as Record<string, unknown>;
          if (typeof obj.text === 'string') return obj.text;
          if (typeof obj.content === 'string') return obj.content;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

/**
 * Parse inbound OpenAI `/v1/chat/completions` JSON body into `CanonicalRequest`
 */
export function parseOpenAIChatRequest(body: Record<string, unknown>): CanonicalRequest {
  const model = typeof body.model === 'string' ? body.model : 'auto';
  const stream = Boolean(body.stream);
  const rawMessages = Array.isArray(body.messages) ? body.messages : [];

  const messages: CanonicalMessage[] = [];
  let systemPrompt: string | undefined;

  for (const item of rawMessages) {
    if (!item || typeof item !== 'object') continue;
    const msg = item as Record<string, unknown>;
    const role = (typeof msg.role === 'string' ? msg.role : 'user') as
      | 'system'
      | 'user'
      | 'assistant'
      | 'tool'
      | 'developer';
    const content = extractTextFromContent(msg.content);

    if (role === 'system' || role === 'developer') {
      systemPrompt = systemPrompt ? `${systemPrompt}\n\n${content}` : content;
      continue;
    }

    let toolCalls: CanonicalToolCall[] | undefined;
    if (Array.isArray(msg.tool_calls)) {
      toolCalls = msg.tool_calls
        .filter((tc): tc is Record<string, unknown> => Boolean(tc && typeof tc === 'object'))
        .map((tc, i) => {
          const fn = (tc.function as Record<string, unknown> | undefined) ?? {};
          return {
            id: typeof tc.id === 'string' ? tc.id : `call_${i}`,
            name: typeof fn.name === 'string' ? fn.name : 'unknown_tool',
            argumentsJson: typeof fn.arguments === 'string' ? fn.arguments : '{}',
          };
        });
    }

    messages.push({
      role: role === 'tool' ? 'tool' : role,
      content,
      thinking: typeof msg.reasoning_content === 'string' ? msg.reasoning_content : undefined,
      toolCalls,
      toolCallId: typeof msg.tool_call_id === 'string' ? msg.tool_call_id : undefined,
      toolName: typeof msg.name === 'string' ? msg.name : undefined,
    });
  }

  let tools: CanonicalTool[] | undefined;
  if (Array.isArray(body.tools)) {
    tools = body.tools
      .filter((t): t is Record<string, unknown> => Boolean(t && typeof t === 'object'))
      .map((t) => {
        const fn = (t.function as Record<string, unknown> | undefined) ?? t;
        return {
          name: typeof fn.name === 'string' ? fn.name : 'tool',
          description: typeof fn.description === 'string' ? fn.description : undefined,
          parameters:
            fn.parameters && typeof fn.parameters === 'object'
              ? (fn.parameters as Record<string, unknown>)
              : { type: 'object', properties: {} },
        };
      });
  }

  return {
    model,
    messages,
    systemPrompt,
    stream,
    temperature: typeof body.temperature === 'number' ? body.temperature : undefined,
    maxTokens:
      typeof body.max_completion_tokens === 'number'
        ? body.max_completion_tokens
        : typeof body.max_tokens === 'number'
          ? body.max_tokens
          : undefined,
    topP: typeof body.top_p === 'number' ? body.top_p : undefined,
    tools,
    toolChoice: body.tool_choice,
    reasoningEffort:
      body.reasoning_effort === 'low' ||
      body.reasoning_effort === 'medium' ||
      body.reasoning_effort === 'high'
        ? body.reasoning_effort
        : undefined,
    inboundProtocol: 'openai-chat',
    sessionId: typeof body.user === 'string' ? body.user : undefined,
  };
}

/**
 * Build upstream OpenAI `/v1/chat/completions` request payload from `CanonicalRequest`
 */
export function buildOpenAIChatUpstreamBody(
  req: CanonicalRequest,
  targetModel: string
): Record<string, unknown> {
  const outMessages: Array<Record<string, unknown>> = [];

  if (req.systemPrompt) {
    outMessages.push({
      role: 'system',
      content: req.systemPrompt,
    });
  }

  for (const m of req.messages) {
    const item: Record<string, unknown> = {
      role: m.role,
      content: m.content,
    };
    if (m.toolCalls && m.toolCalls.length > 0) {
      item.tool_calls = m.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.name,
          arguments: tc.argumentsJson,
        },
      }));
    }
    if (m.role === 'tool' && m.toolCallId) {
      item.tool_call_id = m.toolCallId;
    }
    outMessages.push(item);
  }

  const payload: Record<string, unknown> = {
    model: targetModel,
    messages: outMessages,
    stream: req.stream,
  };

  if (req.temperature !== undefined) payload.temperature = req.temperature;
  if (req.maxTokens !== undefined) payload.max_tokens = req.maxTokens;
  if (req.topP !== undefined) payload.top_p = req.topP;
  if (req.reasoningEffort) payload.reasoning_effort = req.reasoningEffort;

  if (req.tools && req.tools.length > 0) {
    payload.tools = req.tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description ?? '',
        parameters: t.parameters,
      },
    }));
    if (req.toolChoice !== undefined) {
      payload.tool_choice = req.toolChoice;
    }
  }

  return payload;
}

/**
 * Parse a non-streaming OpenAI Chat Completion JSON response into `CanonicalResponse`
 */
export function parseOpenAIChatResponse(
  raw: Record<string, unknown>,
  fallbackModel: string
): CanonicalResponse {
  const choices = Array.isArray(raw.choices) ? raw.choices : [];
  const firstChoice =
    choices[0] && typeof choices[0] === 'object'
      ? (choices[0] as Record<string, unknown>)
      : {};
  const message =
    firstChoice.message && typeof firstChoice.message === 'object'
      ? (firstChoice.message as Record<string, unknown>)
      : {};

  const content = typeof message.content === 'string' ? message.content : '';
  const thinking =
    typeof message.reasoning_content === 'string'
      ? message.reasoning_content
      : typeof message.reasoning === 'string'
        ? message.reasoning
        : undefined;

  let toolCalls: CanonicalToolCall[] | undefined;
  if (Array.isArray(message.tool_calls)) {
    toolCalls = message.tool_calls
      .filter((tc): tc is Record<string, unknown> => Boolean(tc && typeof tc === 'object'))
      .map((tc, idx) => {
        const fn = (tc.function as Record<string, unknown> | undefined) ?? {};
        return {
          id: typeof tc.id === 'string' ? tc.id : `call_${idx}`,
          name: typeof fn.name === 'string' ? fn.name : 'tool',
          argumentsJson: typeof fn.arguments === 'string' ? fn.arguments : '{}',
        };
      });
  }

  const usageObj =
    raw.usage && typeof raw.usage === 'object' ? (raw.usage as Record<string, unknown>) : {};
  const promptTokens = typeof usageObj.prompt_tokens === 'number' ? usageObj.prompt_tokens : 0;
  const completionTokens =
    typeof usageObj.completion_tokens === 'number' ? usageObj.completion_tokens : 0;
  const detailsObj =
    usageObj.prompt_tokens_details && typeof usageObj.prompt_tokens_details === 'object'
      ? (usageObj.prompt_tokens_details as Record<string, unknown>)
      : {};
  const cachedTokens = typeof detailsObj.cached_tokens === 'number' ? detailsObj.cached_tokens : 0;

  return {
    id: typeof raw.id === 'string' ? raw.id : `chatcmpl_${ crypto.randomUUID() }`,
    model: typeof raw.model === 'string' ? raw.model : fallbackModel,
    content,
    thinking,
    toolCalls,
    finishReason:
      toolCalls && toolCalls.length > 0
        ? 'tool_calls'
        : firstChoice.finish_reason === 'length'
          ? 'length'
          : 'stop',
    usage: {
      promptTokens,
      completionTokens,
      cachedTokens,
      totalTokens: promptTokens + completionTokens,
    },
  };
}

/**
 * Format `CanonicalResponse` into OpenAI `/v1/chat/completions` JSON response
 */
export function formatOpenAIChatResponse(resp: CanonicalResponse): Record<string, unknown> {
  const message: Record<string, unknown> = {
    role: 'assistant',
    content: resp.content,
  };
  if (resp.thinking) {
    message.reasoning_content = resp.thinking;
  }
  if (resp.toolCalls && resp.toolCalls.length > 0) {
    message.tool_calls = resp.toolCalls.map((tc) => ({
      id: tc.id,
      type: 'function',
      function: {
        name: tc.name,
        arguments: tc.argumentsJson,
      },
    }));
  }

  return {
    id: resp.id,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: resp.model,
    choices: [
      {
        index: 0,
        message,
        finish_reason: resp.finishReason === 'end_turn' ? 'stop' : resp.finishReason,
      },
    ],
    usage: {
      prompt_tokens: resp.usage.promptTokens,
      completion_tokens: resp.usage.completionTokens,
      total_tokens: resp.usage.totalTokens,
      prompt_tokens_details: {
        cached_tokens: resp.usage.cachedTokens,
      },
    },
  };
}

/**
 * Create a Web `TransformStream` that converts `CanonicalStreamChunk` objects into
 * OpenAI `/v1/chat/completions` SSE byte stream (`data: {...}\n\n`).
 */
export function createCanonicalToOpenAIChatStream(
  model: string,
  sanitizeText: (text: string) => string
): TransformStream<CanonicalStreamChunk, Uint8Array> {
  const encoder = new TextEncoder();
  const completionId = `chatcmpl_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  const created = Math.floor(Date.now() / 1000);

  return new TransformStream<CanonicalStreamChunk, Uint8Array>({
    transform(chunk, controller) {
      if (chunk.type === 'start') {
        const frame = {
          id: chunk.id ?? completionId,
          object: 'chat.completion.chunk',
          created,
          model: chunk.model ?? model,
          choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
        return;
      }

      if (chunk.type === 'thinking_delta' && chunk.thinkingDelta) {
        const frame = {
          id: completionId,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [
            {
              index: 0,
              delta: { reasoning_content: sanitizeText(chunk.thinkingDelta) },
              finish_reason: null,
            },
          ],
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
        return;
      }

      if (chunk.type === 'text_delta' && chunk.textDelta) {
        const frame = {
          id: completionId,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [
            {
              index: 0,
              delta: { content: sanitizeText(chunk.textDelta) },
              finish_reason: null,
            },
          ],
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
        return;
      }

      if (chunk.type === 'tool_call_delta') {
        const frame = {
          id: completionId,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: chunk.toolCallIndex ?? 0,
                    id: chunk.toolCallId,
                    type: 'function',
                    function: {
                      name: chunk.toolName,
                      arguments: chunk.toolArgumentsDelta ?? '',
                    },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
        return;
      }

      if (chunk.type === 'done') {
        const finishFrame = {
          id: completionId,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: chunk.finishReason ?? 'stop',
            },
          ],
          ...(chunk.promptTokens !== undefined
            ? {
                usage: {
                  prompt_tokens: chunk.promptTokens,
                  completion_tokens: chunk.completionTokens ?? 0,
                  total_tokens: (chunk.promptTokens ?? 0) + (chunk.completionTokens ?? 0),
                },
              }
            : {}),
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(finishFrame)}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      }
    },
  });
}
