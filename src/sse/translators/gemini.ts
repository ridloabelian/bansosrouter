import type {
  CanonicalMessage,
  CanonicalRequest,
  CanonicalResponse,
  CanonicalStreamChunk,
  CanonicalTool,
  CanonicalToolCall,
} from './types';

/**
 * Parse inbound Google Gemini `:generateContent` / `:streamGenerateContent` JSON body into `CanonicalRequest`
 */
export function parseGeminiRequest(
  body: Record<string, unknown>,
  modelFromPath: string,
  isStream: boolean
): CanonicalRequest {
  let systemPrompt: string | undefined;
  const sysInst = body.systemInstruction ?? body.system_instruction;
  if (sysInst && typeof sysInst === 'object') {
    const sysObj = sysInst as Record<string, unknown>;
    if (Array.isArray(sysObj.parts)) {
      systemPrompt = sysObj.parts
        .map((p) =>
          p && typeof p === 'object' && typeof (p as Record<string, unknown>).text === 'string'
            ? ((p as Record<string, unknown>).text as string)
            : ''
        )
        .filter(Boolean)
        .join('\n');
    }
  }

  const messages: CanonicalMessage[] = [];
  const contents = Array.isArray(body.contents) ? body.contents : [];
  for (const item of contents) {
    if (!item || typeof item !== 'object') continue;
    const c = item as Record<string, unknown>;
    const role = c.role === 'model' ? 'assistant' : 'user';
    const parts = Array.isArray(c.parts) ? c.parts : [];

    const textParts: string[] = [];
    const toolCalls: CanonicalToolCall[] = [];

    for (const part of parts) {
      if (!part || typeof part !== 'object') continue;
      const p = part as Record<string, unknown>;
      if (typeof p.text === 'string') {
        textParts.push(p.text);
      } else if (p.functionCall && typeof p.functionCall === 'object') {
        const fc = p.functionCall as Record<string, unknown>;
        toolCalls.push({
          id: `call_${crypto.randomUUID().slice(0, 10)}`,
          name: typeof fc.name === 'string' ? fc.name : 'tool',
          argumentsJson: JSON.stringify(fc.args ?? {}),
        });
      } else if (p.functionResponse && typeof p.functionResponse === 'object') {
        const fr = p.functionResponse as Record<string, unknown>;
        messages.push({
          role: 'tool',
          toolName: typeof fr.name === 'string' ? fr.name : 'tool',
          content: JSON.stringify(fr.response ?? {}),
        });
      }
    }

    if (textParts.length > 0 || toolCalls.length > 0) {
      messages.push({
        role,
        content: textParts.join('\n'),
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      });
    }
  }

  let tools: CanonicalTool[] | undefined;
  if (Array.isArray(body.tools)) {
    const collected: CanonicalTool[] = [];
    for (const t of body.tools) {
      if (!t || typeof t !== 'object') continue;
      const tObj = t as Record<string, unknown>;
      if (Array.isArray(tObj.functionDeclarations)) {
        for (const decl of tObj.functionDeclarations) {
          if (!decl || typeof decl !== 'object') continue;
          const d = decl as Record<string, unknown>;
          collected.push({
            name: typeof d.name === 'string' ? d.name : 'tool',
            description: typeof d.description === 'string' ? d.description : undefined,
            parameters:
              d.parameters && typeof d.parameters === 'object'
                ? (d.parameters as Record<string, unknown>)
                : { type: 'object', properties: {} },
          });
        }
      }
    }
    if (collected.length > 0) tools = collected;
  }

  const genConfig =
    body.generationConfig && typeof body.generationConfig === 'object'
      ? (body.generationConfig as Record<string, unknown>)
      : {};

  return {
    model: modelFromPath || 'gemini-2.5-flash',
    messages,
    systemPrompt,
    stream: isStream,
    temperature: typeof genConfig.temperature === 'number' ? genConfig.temperature : undefined,
    maxTokens:
      typeof genConfig.maxOutputTokens === 'number' ? genConfig.maxOutputTokens : undefined,
    topP: typeof genConfig.topP === 'number' ? genConfig.topP : undefined,
    tools,
    inboundProtocol: 'gemini',
  };
}

/**
 * Build upstream Google Gemini `:generateContent` / `:streamGenerateContent` body from `CanonicalRequest`
 */
export function buildGeminiUpstreamBody(req: CanonicalRequest): Record<string, unknown> {
  const contents: Array<Record<string, unknown>> = [];

  for (const m of req.messages) {
    if (m.role === 'tool') {
      let parsedResp: unknown = { result: m.content };
      try {
        parsedResp = JSON.parse(m.content);
      } catch {
        parsedResp = { result: m.content };
      }
      contents.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: m.toolName ?? 'tool_result',
              response:
                parsedResp && typeof parsedResp === 'object'
                  ? parsedResp
                  : { result: parsedResp },
            },
          },
        ],
      });
      continue;
    }

    const parts: Array<Record<string, unknown>> = [];
    if (m.content) {
      parts.push({ text: m.content });
    }
    if (m.toolCalls && m.toolCalls.length > 0) {
      for (const tc of m.toolCalls) {
        let parsedArgs: unknown = {};
        try {
          parsedArgs = JSON.parse(tc.argumentsJson);
        } catch {
          parsedArgs = {};
        }
        parts.push({
          functionCall: {
            name: tc.name,
            args: parsedArgs,
          },
        });
      }
    }

    if (parts.length > 0) {
      contents.push({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts,
      });
    }
  }

  const payload: Record<string, unknown> = {
    contents,
  };

  if (req.systemPrompt) {
    payload.systemInstruction = {
      parts: [{ text: req.systemPrompt }],
    };
  }

  const generationConfig: Record<string, unknown> = {};
  if (req.temperature !== undefined) generationConfig.temperature = req.temperature;
  if (req.maxTokens !== undefined) generationConfig.maxOutputTokens = req.maxTokens;
  if (req.topP !== undefined) generationConfig.topP = req.topP;
  if (Object.keys(generationConfig).length > 0) {
    payload.generationConfig = generationConfig;
  }

  if (req.tools && req.tools.length > 0) {
    payload.tools = [
      {
        functionDeclarations: req.tools.map((t) => ({
          name: t.name,
          description: t.description ?? '',
          parameters: t.parameters,
        })),
      },
    ];
  }

  return payload;
}

/**
 * Parse a non-streaming Google Gemini JSON response into `CanonicalResponse`
 */
export function parseGeminiResponse(
  raw: Record<string, unknown>,
  fallbackModel: string
): CanonicalResponse {
  const candidates = Array.isArray(raw.candidates) ? raw.candidates : [];
  const firstCandidate =
    candidates[0] && typeof candidates[0] === 'object'
      ? (candidates[0] as Record<string, unknown>)
      : {};
  const contentObj =
    firstCandidate.content && typeof firstCandidate.content === 'object'
      ? (firstCandidate.content as Record<string, unknown>)
      : {};
  const parts = Array.isArray(contentObj.parts) ? contentObj.parts : [];

  const textParts: string[] = [];
  const thoughtParts: string[] = [];
  const toolCalls: CanonicalToolCall[] = [];

  for (const part of parts) {
    if (!part || typeof part !== 'object') continue;
    const p = part as Record<string, unknown>;
    if (p.thought === true && typeof p.text === 'string') {
      thoughtParts.push(p.text);
    } else if (typeof p.text === 'string') {
      textParts.push(p.text);
    } else if (p.functionCall && typeof p.functionCall === 'object') {
      const fc = p.functionCall as Record<string, unknown>;
      toolCalls.push({
        id: `call_${crypto.randomUUID().slice(0, 10)}`,
        name: typeof fc.name === 'string' ? fc.name : 'tool',
        argumentsJson: JSON.stringify(fc.args ?? {}),
      });
    }
  }

  const usageMeta =
    raw.usageMetadata && typeof raw.usageMetadata === 'object'
      ? (raw.usageMetadata as Record<string, unknown>)
      : {};
  const promptTokens =
    typeof usageMeta.promptTokenCount === 'number' ? usageMeta.promptTokenCount : 0;
  const completionTokens =
    typeof usageMeta.candidatesTokenCount === 'number' ? usageMeta.candidatesTokenCount : 0;
  const cachedTokens =
    typeof usageMeta.cachedContentTokenCount === 'number'
      ? usageMeta.cachedContentTokenCount
      : 0;

  return {
    id: typeof raw.responseId === 'string' ? raw.responseId : `gem_${crypto.randomUUID().slice(0, 16)}`,
    model: typeof raw.modelVersion === 'string' ? raw.modelVersion : fallbackModel,
    content: textParts.join(''),
    thinking: thoughtParts.length > 0 ? thoughtParts.join('\n') : undefined,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
    usage: {
      promptTokens,
      completionTokens,
      cachedTokens,
      totalTokens: promptTokens + completionTokens,
    },
  };
}

/**
 * Format `CanonicalResponse` into Google Gemini `generateContent` JSON response
 */
export function formatGeminiResponse(resp: CanonicalResponse): Record<string, unknown> {
  const parts: Array<Record<string, unknown>> = [];
  if (resp.thinking) {
    parts.push({ text: resp.thinking, thought: true });
  }
  if (resp.content || (!resp.toolCalls || resp.toolCalls.length === 0)) {
    parts.push({ text: resp.content });
  }
  if (resp.toolCalls && resp.toolCalls.length > 0) {
    for (const tc of resp.toolCalls) {
      let args: unknown = {};
      try {
        args = JSON.parse(tc.argumentsJson);
      } catch {
        args = {};
      }
      parts.push({
        functionCall: {
          name: tc.name,
          args,
        },
      });
    }
  }

  return {
    candidates: [
      {
        content: {
          role: 'model',
          parts,
        },
        finishReason: 'STOP',
        index: 0,
      },
    ],
    usageMetadata: {
      promptTokenCount: resp.usage.promptTokens,
      candidatesTokenCount: resp.usage.completionTokens,
      cachedContentTokenCount: resp.usage.cachedTokens,
      totalTokenCount: resp.usage.totalTokens,
    },
    modelVersion: resp.model,
  };
}

/**
 * Create a Web `TransformStream` that converts `CanonicalStreamChunk` into Google Gemini
 * `:streamGenerateContent?alt=sse` SSE chunks.
 */
export function createCanonicalToGeminiStream(
  model: string,
  sanitizeText: (text: string) => string
): TransformStream<CanonicalStreamChunk, Uint8Array> {
  const encoder = new TextEncoder();

  return new TransformStream<CanonicalStreamChunk, Uint8Array>({
    transform(chunk, controller) {
      if (chunk.type === 'thinking_delta' && chunk.thinkingDelta) {
        const frame = {
          candidates: [
            {
              content: {
                role: 'model',
                parts: [{ text: sanitizeText(chunk.thinkingDelta), thought: true }],
              },
              index: 0,
            },
          ],
          modelVersion: model,
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
        return;
      }

      if (chunk.type === 'text_delta' && chunk.textDelta) {
        const frame = {
          candidates: [
            {
              content: {
                role: 'model',
                parts: [{ text: sanitizeText(chunk.textDelta) }],
              },
              index: 0,
            },
          ],
          modelVersion: model,
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
        return;
      }

      if (chunk.type === 'done') {
        const frame = {
          candidates: [
            {
              content: { role: 'model', parts: [{ text: '' }] },
              finishReason: 'STOP',
              index: 0,
            },
          ],
          usageMetadata: {
            promptTokenCount: chunk.promptTokens ?? 0,
            candidatesTokenCount: chunk.completionTokens ?? 0,
            totalTokenCount: (chunk.promptTokens ?? 0) + (chunk.completionTokens ?? 0),
          },
          modelVersion: model,
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
      }
    },
  });
}
