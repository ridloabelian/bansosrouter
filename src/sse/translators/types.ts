export type ProtocolFormat =
  | 'openai-chat'
  | 'openai-responses'
  | 'anthropic-messages'
  | 'gemini';

export interface CanonicalTool {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
}

export interface CanonicalToolCall {
  id: string;
  name: string;
  argumentsJson: string;
}

export interface CanonicalMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  thinking?: string;
  thinkingSignature?: string;
  toolCalls?: CanonicalToolCall[];
  toolCallId?: string;
  toolName?: string;
  cacheControl?: { type: 'ephemeral' } | null;
}

export interface CanonicalRequest {
  model: string;
  messages: CanonicalMessage[];
  systemPrompt?: string;
  systemCacheControl?: { type: 'ephemeral' } | null;
  stream: boolean;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  tools?: CanonicalTool[];
  toolChoice?: unknown;
  reasoningEffort?: 'low' | 'medium' | 'high';
  thinkingBudgetTokens?: number;
  inboundProtocol: ProtocolFormat;
  sessionId?: string;
  rawExtra?: Record<string, unknown>;
}

export interface CanonicalStreamChunk {
  type:
    | 'start'
    | 'thinking_delta'
    | 'text_delta'
    | 'tool_call_delta'
    | 'usage'
    | 'done'
    | 'error';
  id?: string;
  model?: string;
  textDelta?: string;
  thinkingDelta?: string;
  toolCallIndex?: number;
  toolCallId?: string;
  toolName?: string;
  toolArgumentsDelta?: string;
  promptTokens?: number;
  completionTokens?: number;
  cachedTokens?: number;
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'end_turn' | 'error';
  errorMessage?: string;
}

export interface CanonicalResponse {
  id: string;
  model: string;
  content: string;
  thinking?: string;
  toolCalls?: CanonicalToolCall[];
  finishReason: 'stop' | 'length' | 'tool_calls' | 'end_turn';
  usage: {
    promptTokens: number;
    completionTokens: number;
    cachedTokens: number;
    totalTokens: number;
  };
}
