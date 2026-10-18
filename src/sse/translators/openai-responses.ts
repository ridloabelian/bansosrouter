import type {
  CanonicalMessage,
  CanonicalRequest,
  CanonicalResponse,
  CanonicalStreamChunk,
  CanonicalTool,
} from './types';

/**
 * Parse inbound OpenAI Responses API (`/v1/responses` — Codex CLI) JSON body into `CanonicalRequest`
 */
export function parseOpenAIResponsesRequest(body: Record<string, unknown>): CanonicalRequest {
  const model = typeof body.model === 'string' ? body.model : 'auto/coding';
  const stream = Boolean(body.stream);
  const systemPrompt = typeof body.instructions === 'string' ? body.instructions : undefined;

  const messages: CanonicalMessage[] = [];
  const rawInput = body.input;

  if (typeof rawInput === 'string') {
    messages.push({ role: 'user', content: rawInput });
  } else if (Array.isArray(rawInput)) {
    for (const item of rawInput) {
      if (typeof item === 'string') {
        messages.push({ role: 'user', content: item });
        continue;
      }
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      const itemType = typeof obj.type === 'string' ? obj.type : 'message';

      if (itemType === 'function_call') {
        messages.push({
          role: 'assistant',
          content: '',
          toolCalls: [
            {
              id: typeof obj.call_id === 'string' ? obj.call_id : 'call_0',
              name: typeof obj.name === 'string' ? obj.name : 'tool',
              argumentsJson: typeof obj.arguments === 'string' ? obj.arguments : '{}',
            },
          ],
        });
        continue;
      }

      if (itemType === 'function_call_output') {
        messages.push({
          role: 'tool',
          content: typeof obj.output === 'string' ? obj.output : JSON.stringify(obj.output ?? ''),
          toolCallId: typeof obj.call_id === 'string' ? obj.call_id : 'call_0',
        });
        continue;
      }

      const role =
        obj.role === 'assistant' || obj.role === 'system' || obj.role === 'tool'
          ? obj.role
          : 'user';

      let textContent = '';
      if (typeof obj.content === 'string') {
        textContent = obj.content;
      } else if (Array.isArray(obj.content)) {
        textContent = obj.content
          .map((part) => {
            if (!part || typeof part !== 'object') return '';
            const p = part as Record<string, unknown>;
            if (typeof p.text === 'string') return p.text;
            if (typeof p.input_text === 'string') return p.input_text;
            return '';
          })
          .filter(Boolean)
          .join('\n');
      }

      messages.push({
        role: role === 'system' ? 'user' : role,
        content: textContent,
      });
    }
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

  const reasoningObj =
    body.reasoning && typeof body.reasoning === 'object'
      ? (body.reasoning as Record<string, unknown>)
      : {};
  const effort = reasoningObj.effort;

  return {
    model,
    messages,
    systemPrompt,
    stream,
    temperature: typeof body.temperature === 'number' ? body.temperature : undefined,
    maxTokens: typeof body.max_output_tokens === 'number' ? body.max_output_tokens : undefined,
    tools,
    toolChoice: body.tool_choice,
    reasoningEffort:
      effort === 'low' || effort === 'medium' || effort === 'high' ? effort : undefined,
    inboundProtocol: 'openai-responses',
    sessionId:
      typeof body.previous_response_id === 'string' ? body.previous_response_id : undefined,
  };
}

/**
 * Format `CanonicalResponse` into OpenAI `/v1/responses` JSON payload (Codex CLI compatible)
 */
export function formatOpenAIResponsesResponse(resp: CanonicalResponse): Record<string, unknown> {
  const outputItems: Array<Record<string, unknown>> = [];

  if (resp.thinking) {
    outputItems.push({
      id: `rs_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
      type: 'reasoning',
      summary: [
        {
          type: 'summary_text',
          text: resp.thinking,
        },
      ],
    });
  }

  if (resp.content || (!resp.toolCalls || resp.toolCalls.length === 0)) {
    outputItems.push({
      id: `msg_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
      type: 'message',
      status: 'completed',
      role: 'assistant',
      content: [
        {
          type: 'output_text',
          text: resp.content,
          annotations: [],
        },
      ],
    });
  }

  if (resp.toolCalls && resp.toolCalls.length > 0) {
    for (const tc of resp.toolCalls) {
      outputItems.push({
        id: `fc_${tc.id}`,
        type: 'function_call',
        status: 'completed',
        call_id: tc.id,
        name: tc.name,
        arguments: tc.argumentsJson,
      });
    }
  }

  return {
    id: resp.id.startsWith('resp_') ? resp.id : `resp_${resp.id}`,
    object: 'response',
    created_at: Math.floor(Date.now() / 1000),
    status: 'completed',
    model: resp.model,
    output: outputItems,
    output_text: resp.content,
    usage: {
      input_tokens: resp.usage.promptTokens,
      output_tokens: resp.usage.completionTokens,
      total_tokens: resp.usage.totalTokens,
      input_tokens_details: {
        cached_tokens: resp.usage.cachedTokens,
      },
    },
  };
}

/**
 * Create a Web `TransformStream` that converts `CanonicalStreamChunk` into OpenAI `/v1/responses`
 * SSE events (`response.created`, `response.output_text.delta`, `response.function_call_arguments.delta`, `response.completed`).
 */
export function createCanonicalToOpenAIResponsesStream(
  model: string,
  sanitizeText: (text: string) => string
): TransformStream<CanonicalStreamChunk, Uint8Array> {
  const encoder = new TextEncoder();
  const responseId = `resp_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
  const messageItemId = `msg_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  let fullText = '';
  let fullThinking = '';

  const emitEvent = (
    controller: TransformStreamDefaultController<Uint8Array>,
    eventName: string,
    payload: Record<string, unknown>
  ): void => {
    controller.enqueue(
      encoder.encode(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`)
    );
  };

  return new TransformStream<CanonicalStreamChunk, Uint8Array>({
    transform(chunk, controller) {
      if (chunk.type === 'start') {
        emitEvent(controller, 'response.created', {
          type: 'response.created',
          response: {
            id: responseId,
            object: 'response',
            status: 'in_progress',
            model: chunk.model ?? model,
            output: [],
          },
        });
        emitEvent(controller, 'response.output_item.added', {
          type: 'response.output_item.added',
          output_index: 0,
          item: {
            id: messageItemId,
            type: 'message',
            status: 'in_progress',
            role: 'assistant',
            content: [],
          },
        });
        return;
      }

      if (chunk.type === 'thinking_delta' && chunk.thinkingDelta) {
        const clean = sanitizeText(chunk.thinkingDelta);
        fullThinking += clean;
        emitEvent(controller, 'response.reasoning_summary_text.delta', {
          type: 'response.reasoning_summary_text.delta',
          item_id: messageItemId,
          output_index: 0,
          summary_index: 0,
          delta: clean,
        });
        return;
      }

      if (chunk.type === 'text_delta' && chunk.textDelta) {
        const clean = sanitizeText(chunk.textDelta);
        fullText += clean;
        emitEvent(controller, 'response.output_text.delta', {
          type: 'response.output_text.delta',
          item_id: messageItemId,
          output_index: 0,
          content_index: 0,
          delta: clean,
        });
        return;
      }

      if (chunk.type === 'tool_call_delta') {
        emitEvent(controller, 'response.function_call_arguments.delta', {
          type: 'response.function_call_arguments.delta',
          item_id: chunk.toolCallId ?? 'fc_0',
          output_index: (chunk.toolCallIndex ?? 0) + 1,
          call_id: chunk.toolCallId ?? 'call_0',
          name: chunk.toolName,
          delta: chunk.toolArgumentsDelta ?? '',
        });
        return;
      }

      if (chunk.type === 'done') {
        emitEvent(controller, 'response.output_text.done', {
          type: 'response.output_text.done',
          item_id: messageItemId,
          output_index: 0,
          content_index: 0,
          text: fullText,
        });
        emitEvent(controller, 'response.completed', {
          type: 'response.completed',
          response: {
            id: responseId,
            object: 'response',
            status: 'completed',
            model,
            output_text: fullText,
            reasoning_summary: fullThinking || undefined,
            usage: {
              input_tokens: chunk.promptTokens ?? 0,
              output_tokens: chunk.completionTokens ?? 0,
              total_tokens: (chunk.promptTokens ?? 0) + (chunk.completionTokens ?? 0),
            },
          },
        });
      }
    },
  });
}
