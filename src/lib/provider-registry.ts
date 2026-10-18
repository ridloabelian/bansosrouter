import type { ProtocolFormat } from '../sse/translators/types';

export type ProviderCategory =
  | 'oauth'
  | 'ide'
  | 'frontier'
  | 'inference'
  | 'gateways'
  | 'regional'
  | 'enterprise'
  | 'specialty'
  | 'audio'
  | 'search'
  | 'noauth'
  | 'web_cookie'
  | 'remote_local';

export interface ProviderCategoryMeta {
  id: ProviderCategory | 'all';
  label: string;
  shortLabel: string;
  description: string;
}

export interface ProviderRegistryItem {
  id: string;
  name: string;
  category: ProviderCategory;
  color: string;
  textIcon: string;
  authType:
    | 'oauth_device'
    | 'oauth_pkce'
    | 'api_key'
    | 'ide_token'
    | 'no_auth'
    | 'web_cookie'
    | 'workers_ai'
    | 'service_account';
  tier: 'free' | 'subscription' | 'paid' | 'freemium';
  tosRisk: 'safe' | 'caution' | 'tos_avoid';
  protocol: ProtocolFormat | 'workers-ai';
  baseUrl: string;
  website: string;
  defaultModels: string[];
  description: string;
}

export const PROVIDER_CATEGORIES: ProviderCategoryMeta[] = [
  {
    id: 'all',
    label: 'All Providers',
    shortLabel: 'All',
    description: 'Complete OmniRoute + 9router Cloudflare-compatible catalog',
  },
  {
    id: 'oauth',
    label: 'OAuth Providers',
    shortLabel: 'OAuth',
    description: 'Multi-account CLI & Subscription OAuth (Device Code & PKCE Paste-Callback)',
  },
  {
    id: 'ide',
    label: 'IDE Providers',
    shortLabel: 'IDE',
    description: 'AI IDE Subscription & Session Token integrations (Cursor, Zed, Trae)',
  },
  {
    id: 'frontier',
    label: 'Frontier Labs — API Key',
    shortLabel: 'Frontier Labs',
    description: 'Direct first-party foundation model lab APIs',
  },
  {
    id: 'inference',
    label: 'Inference Hosts — Fast Cloud GPU',
    shortLabel: 'Inference Hosts',
    description: 'High-throughput LPU, Wafer-Scale, and GPU cloud inference hosts',
  },
  {
    id: 'gateways',
    label: 'AI Gateways & Aggregators',
    shortLabel: 'Gateways',
    description: 'Unified multi-model routers, free-tier pools, and community gateways',
  },
  {
    id: 'regional',
    label: 'Regional, China & Sovereign Labs',
    shortLabel: 'Regional & China',
    description: 'Z.AI (GLM), Kimi, Qwen DashScope, Volcengine Doubao, MiniMax, DeepSeek, SEA & EU labs',
  },
  {
    id: 'enterprise',
    label: 'Enterprise Cloud',
    shortLabel: 'Enterprise Cloud',
    description: 'Cloudflare Workers AI, Vertex AI, AWS Bedrock, Azure Foundry, Snowflake, Databricks',
  },
  {
    id: 'specialty',
    label: 'Specialty Media, Image & Embeddings',
    shortLabel: 'Media & Embeddings',
    description: 'Image/Video generation, OCR, Embeddings, and Reranking providers',
  },
  {
    id: 'audio',
    label: 'Audio Providers (TTS & STT)',
    shortLabel: 'Audio',
    description: 'Text-to-Speech and Speech-to-Text voice intelligence APIs',
  },
  {
    id: 'search',
    label: 'Search & Web Grounding',
    shortLabel: 'Search',
    description: 'AI search engines, web scrapers, and RAG grounding endpoints',
  },
  {
    id: 'noauth',
    label: 'No-Auth Free Providers',
    shortLabel: 'No-Auth Free',
    description: 'Zero-key public inference endpoints & agent bridges',
  },
  {
    id: 'web_cookie',
    label: 'Web / Cookie Session Providers',
    shortLabel: 'Web / Cookie',
    description: 'Consumer web chat session forwarders (Experimental / ToS Caution)',
  },
  {
    id: 'remote_local',
    label: 'Self-Hosted / Tunnel Runtimes',
    shortLabel: 'Self-Hosted Tunnel',
    description: 'Ollama, vLLM, LM Studio, llama.cpp exposed via Cloudflare Tunnel or HTTPS',
  },
];

type CompactProviderTuple = [
  id: string,
  name: string,
  category: ProviderCategory,
  color: string,
  textIcon: string,
  authType: ProviderRegistryItem['authType'],
  tier: ProviderRegistryItem['tier'],
  tosRisk: ProviderRegistryItem['tosRisk'],
  protocol: ProviderRegistryItem['protocol'],
  baseUrl: string,
  website: string,
  defaultModels: string[],
  description: string,
];

const RAW_PROVIDERS: CompactProviderTuple[] = [
  // ============================================================================
  // 1. OAUTH PROVIDERS (24 Providers)
  // ============================================================================
  ['claude-code', 'Claude Code', 'oauth', '#D97757', 'CC', 'oauth_pkce', 'subscription', 'caution', 'anthropic-messages', 'https://api.anthropic.com', 'https://claude.ai', ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5'], 'Anthropic Pro/Max 5-hour window OAuth with PKCE Paste-Callback helper'],
  ['codex', 'OpenAI Codex', 'oauth', '#3B82F6', 'CX', 'oauth_pkce', 'subscription', 'caution', 'openai-chat', 'https://api.openai.com/v1', 'https://chatgpt.com', ['codex-mini-latest', 'o3-mini', 'gpt-4o'], 'ChatGPT Plus/Pro OAuth (`localhost:1455`) for Codex CLI & Responses API'],
  ['gemini-cli', 'Gemini CLI', 'oauth', '#4285F4', 'GC', 'oauth_pkce', 'free', 'safe', 'gemini', 'https://generativelanguage.googleapis.com', 'https://developers.google.com', ['gemini-2.5-pro', 'gemini-2.5-flash'], 'Google Cloud Code Assist OAuth (`localhost:8085`) with high daily free quota'],
  ['github-copilot', 'GitHub Copilot', 'oauth', '#333333', 'GH', 'oauth_device', 'subscription', 'caution', 'openai-chat', 'https://api.githubcopilot.com', 'https://github.com/features/copilot', ['claude-sonnet-4-6', 'gpt-4o', 'o3-mini'], 'GitHub Device Code Poll (`Iv1.b507...`) with automatic Copilot session token rotation'],
  ['ghe-copilot', 'GitHub Enterprise Copilot', 'oauth', '#10B981', 'GHE', 'oauth_device', 'subscription', 'safe', 'openai-chat', 'https://api.githubcopilot.com', 'https://github.com/enterprise', ['claude-sonnet-4-6', 'gpt-4o'], 'Enterprise GitHub Copilot Device OAuth with dedicated org endpoint'],
  ['antigravity', 'Antigravity', 'oauth', '#F59E0B', 'AG', 'oauth_pkce', 'free', 'tos_avoid', 'gemini', 'https://cloudcode-pa.googleapis.com', 'https://antigravity.google', ['gemini-2.5-pro', 'claude-sonnet-4-6'], 'Antigravity OAuth session proxy (badged `tos: avoid` for consumer account protection)'],
  ['agy', 'Antigravity CLI', 'oauth', '#F59E0B', 'AGY', 'oauth_pkce', 'free', 'tos_avoid', 'gemini', 'https://cloudcode-pa.googleapis.com', 'https://antigravity.google', ['gemini-2.5-pro', 'gemini-2.5-flash'], 'Antigravity CLI OAuth token bridge (`tos: avoid`)'],
  ['qwen', 'Qwen Code OAuth', 'oauth', '#615CED', 'QW', 'oauth_device', 'free', 'caution', 'openai-chat', 'https://portal.qwen.ai/v1', 'https://chat.qwen.ai', ['qwen-2.5-coder-32b', 'qwen-max'], 'Alibaba Qwen Code CLI Device Code OAuth with 1M+ daily free coding tokens'],
  ['kiro', 'Kiro AI', 'oauth', '#FF6B35', 'KR', 'oauth_device', 'free', 'caution', 'openai-chat', 'https://codewhisperer.us-east-1.amazonaws.com/v1', 'https://kiro.dev', ['claude-sonnet-4-6', 'claude-haiku-4-5'], 'AWS Kiro IDE OAuth Device Code flow for Claude Sonnet & Haiku'],
  ['amazon-q', 'Amazon Q Developer', 'oauth', '#FF9900', 'AQ', 'oauth_device', 'subscription', 'safe', 'openai-chat', 'https://codewhisperer.us-east-1.amazonaws.com/v1', 'https://aws.amazon.com/q/developer/', ['claude-sonnet-4-6'], 'AWS Builder ID / IAM Identity Center Device OAuth for Amazon Q'],
  ['cline', 'Cline', 'oauth', '#5B9BD5', 'CL', 'oauth_pkce', 'freemium', 'caution', 'openai-chat', 'https://api.cline.bot/v1', 'https://cline.bot', ['claude-sonnet-4-6', 'deepseek-r1'], 'Cline IDE OAuth account integration'],
  ['clinepass', 'ClinePass', 'oauth', '#9D4EDD', 'CP', 'oauth_pkce', 'subscription', 'safe', 'openai-chat', 'https://api.cline.bot/v1', 'https://cline.bot/cline-pass', ['claude-sonnet-4-6', 'claude-opus-4-6'], 'ClinePass subscription OAuth router'],
  ['kilocode', 'Kilo Code', 'oauth', '#FF6B35', 'KC', 'oauth_device', 'freemium', 'caution', 'openai-chat', 'https://api.kilocode.ai/v1', 'https://kilocode.ai', ['claude-sonnet-4-6', 'gpt-4o'], 'Kilo Code IDE OAuth connection'],
  ['kimi-coding', 'Kimi Code CLI', 'oauth', '#1E40AF', 'KC', 'oauth_device', 'subscription', 'safe', 'openai-chat', 'https://api.moonshot.cn/v1', 'https://www.kimi.ai/code', ['kimi-k2-0711-preview', 'moonshot-v1-128k'], 'Moonshot Kimi Code CLI subscription OAuth'],
  ['iflow', 'iFlow CLI', 'oauth', '#0EA5E9', 'IF', 'oauth_pkce', 'free', 'caution', 'openai-chat', 'https://apis.iflow.cn/v1', 'https://iflow.cn', ['qwen-2.5-coder-32b', 'deepseek-r1'], 'iFlow AI coding assistant PKCE OAuth'],
  ['qoder', 'Qoder', 'oauth', '#6366F1', 'QD', 'oauth_pkce', 'freemium', 'caution', 'openai-chat', 'https://api.qoder.com/v1', 'https://qoder.com', ['claude-sonnet-4-6', 'gpt-4o'], 'Qoder coding assistant OAuth session'],
  ['gitlab-duo', 'GitLab Duo', 'oauth', '#FC6D26', 'GL', 'oauth_pkce', 'subscription', 'safe', 'openai-chat', 'https://gitlab.com/api/v4/chat', 'https://docs.gitlab.com/user/duo_agent_platform/', ['claude-sonnet-4-6'], 'GitLab Duo Agent Platform OAuth integration'],
  ['xai-oauth', 'xAI OAuth (Grok)', 'oauth', '#1DA1F2', 'XA', 'oauth_pkce', 'subscription', 'caution', 'openai-chat', 'https://api.x.ai/v1', 'https://x.ai', ['grok-3-beta', 'grok-3-mini-beta'], 'xAI Grok OAuth consumer/developer bridge'],
  ['grok-cli', 'Grok Build CLI', 'oauth', '#111827', 'GB', 'oauth_device', 'freemium', 'caution', 'openai-chat', 'https://api.x.ai/v1', 'https://x.ai', ['grok-3-beta'], 'Grok Build CLI OAuth authentication'],
  ['openference', 'Openference OAuth', 'oauth', '#6366F1', 'OF', 'oauth_pkce', 'freemium', 'safe', 'openai-chat', 'https://api.openference.com/v1', 'https://openference.com', ['llama-3.3-70b-versatile'], 'Openference OAuth provider'],
  ['codebuddy-cn', 'CodeBuddy CN (Tencent)', 'oauth', '#006EFF', 'CB', 'oauth_pkce', 'free', 'caution', 'openai-chat', 'https://copilot.tencent.com/v1', 'https://copilot.tencent.com', ['hunyuan-turbos-latest', 'deepseek-r1'], 'Tencent CodeBuddy CN coding assistant OAuth'],
  ['codebuddy-intl', 'CodeBuddy Intl', 'oauth', '#006EFF', 'CBI', 'oauth_pkce', 'free', 'caution', 'openai-chat', 'https://api.codebuddy.ai/v1', 'https://www.codebuddy.ai', ['claude-sonnet-4-6', 'gpt-4o'], 'CodeBuddy International OAuth assistant'],
  ['workbuddy', 'WorkBuddy', 'oauth', '#1A73E8', 'WB', 'oauth_pkce', 'freemium', 'safe', 'openai-chat', 'https://api.workbuddy.ai/v1', 'https://www.workbuddy.ai', ['gpt-4o', 'claude-sonnet-4-6'], 'WorkBuddy AI workspace OAuth'],
  ['muse-code', 'Muse Code (Meta)', 'oauth', '#0866FF', 'MC', 'oauth_pkce', 'free', 'caution', 'openai-chat', 'https://api.llama.com/v1', 'https://ai.developer.meta.com/docs/muse-code/auth', ['llama-4-maverick-17b-128e'], 'Meta Muse Code developer OAuth flow'],

  // ============================================================================
  // 2. IDE PROVIDERS (6 Providers)
  // ============================================================================
  ['cursor', 'Cursor IDE', 'ide', '#00D4AA', 'CU', 'ide_token', 'subscription', 'tos_avoid', 'openai-chat', 'https://api2.cursor.sh/v1', 'https://cursor.com', ['claude-sonnet-4-6', 'gpt-4o', 'cursor-small'], 'Cursor IDE Pro Bearer token router (`tos: avoid` warning for external use)'],
  ['cursor-api', 'Cursor Background Agent API', 'ide', '#00D4AA', 'CA', 'api_key', 'subscription', 'safe', 'openai-chat', 'https://api.cursor.com/v1', 'https://cursor.com', ['claude-sonnet-4-6', 'gpt-4o'], 'Official Cursor API key integration for background coding agents'],
  ['zed', 'Zed IDE', 'ide', '#084CCF', 'ZD', 'ide_token', 'subscription', 'caution', 'openai-chat', 'https://cloud.zed.dev/v1', 'https://zed.dev', ['claude-sonnet-4-6', 'claude-haiku-4-5'], 'Zed Pro IDE hosted LLM token integration'],
  ['zed-hosted', 'Zed Hosted Models', 'ide', '#101010', 'ZH', 'ide_token', 'subscription', 'caution', 'openai-chat', 'https://llm.zed.dev/v1', 'https://zed.dev', ['claude-sonnet-4-6'], 'Zed Hosted model gateway'],
  ['trae', 'Trae IDE (ByteDance)', 'ide', '#FF7849', 'TR', 'ide_token', 'free', 'caution', 'openai-chat', 'https://api.trae.ai/v1', 'https://trae.ai', ['claude-sonnet-4-6', 'deepseek-r1', 'gpt-4o'], 'Trae AI IDE token integration'],
  ['devin-desktop', 'Devin Desktop / API', 'ide', '#6366F1', 'DD', 'api_key', 'subscription', 'safe', 'openai-chat', 'https://api.devin.ai/v1', 'https://devin.ai', ['devin-agent-v2'], 'Cognition Devin API & Desktop session integration'],

  // ============================================================================
  // 3. FRONTIER LABS — API KEY (23 Providers)
  // ============================================================================
  ['openai', 'OpenAI', 'frontier', '#10A37F', 'OA', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.openai.com/v1', 'https://platform.openai.com', ['gpt-4o', 'gpt-4o-mini', 'o3-mini', 'codex-mini-latest'], 'Official OpenAI Platform API (Chat Completions, Responses API, Embeddings, Audio)'],
  ['anthropic', 'Anthropic', 'frontier', '#D97757', 'AN', 'api_key', 'paid', 'safe', 'anthropic-messages', 'https://api.anthropic.com', 'https://console.anthropic.com', ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5'], 'Official Anthropic Messages API with Prompt Caching & Extended Thinking'],
  ['gemini', 'Gemini (Google AI Studio)', 'frontier', '#4285F4', 'GE', 'api_key', 'freemium', 'safe', 'gemini', 'https://generativelanguage.googleapis.com', 'https://aistudio.google.com/apikey', ['gemini-2.5-pro', 'gemini-2.5-flash'], 'Google AI Studio API (1M+ token context window, generous Free Tier + Paid Pay-as-you-go)'],
  ['xai', 'xAI (Grok)', 'frontier', '#1DA1F2', 'XA', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.x.ai/v1', 'https://console.x.ai', ['grok-3-beta', 'grok-3-mini-beta'], 'Official xAI Grok API (OpenAI-compatible)'],
  ['mistral', 'Mistral AI (La Plateforme)', 'frontier', '#FF7000', 'MI', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.mistral.ai/v1', 'https://console.mistral.ai', ['mistral-large-latest', 'pixtral-large-latest', 'codestral-latest'], 'Mistral La Plateforme API with Free Experiment plan & native `/v1/ocr`'],
  ['codestral', 'Codestral (Mistral Coding)', 'frontier', '#FF7000', 'CS', 'api_key', 'free', 'safe', 'openai-chat', 'https://codestral.mistral.ai/v1', 'https://console.mistral.ai/codestral', ['codestral-latest'], 'Dedicated free/paid Mistral Codestral 256K coding endpoint'],
  ['cohere', 'Cohere', 'frontier', '#39594D', 'CO', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.cohere.ai/compatibility/v1', 'https://dashboard.cohere.com', ['command-a-03-2025', 'command-r-plus-08-2024', 'rerank-v3.5'], 'Cohere Command-A & Rerank v3.5 API (Trial Free Key + Production)'],
  ['perplexity', 'Perplexity Sonar API', 'frontier', '#20808D', 'PP', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.perplexity.ai', 'https://www.perplexity.ai/settings/api', ['sonar-pro', 'sonar-reasoning-pro', 'sonar'], 'Perplexity web-grounded Sonar & Sonar Reasoning API'],
  ['perplexity-agent', 'Perplexity Agent', 'frontier', '#20808D', 'PA', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.perplexity.ai', 'https://www.perplexity.ai', ['sonar-deep-research'], 'Perplexity Deep Research agentic endpoint'],
  ['meta-llama', 'Meta Llama API', 'frontier', '#0F766E', 'ML', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.llama.com/compat/v1', 'https://llama.developer.meta.com', ['llama-4-maverick-17b-128e-instruct', 'llama-4-scout-17b-16e-instruct'], 'Official first-party Meta Llama 4 Developer API'],
  ['ai21', 'AI21 Labs (Jamba)', 'frontier', '#0284C7', 'A21', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.ai21.com/studio/v1', 'https://studio.ai21.com', ['jamba-1.6-large', 'jamba-1.6-mini'], 'AI21 Jamba 256K hybrid SSM-Transformer API'],
  ['reka', 'Reka AI', 'frontier', '#111827', 'RK', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.reka.ai/v1', 'https://platform.reka.ai', ['reka-core', 'reka-flash'], 'Reka multimodal frontier models'],
  ['liquid', 'Liquid AI (LFM)', 'frontier', '#06B6D4', 'LQ', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.liquid.ai/v1', 'https://playground.liquid.ai', ['lfm-40b', 'lfm-7b'], 'Liquid Foundation Models non-Transformer architecture'],
  ['upstage', 'Upstage Solar', 'frontier', '#0F766E', 'UP', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.upstage.ai/v1/solar', 'https://console.upstage.ai', ['solar-pro', 'solar-mini'], 'Upstage Solar LLM & Document Parse OCR'],
  ['writer', 'Writer Palmyra', 'frontier', '#111827', 'WR', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.writer.com/v1', 'https://dev.writer.com', ['palmyra-x-004', 'palmyra-fin'], 'Writer enterprise Palmyra models'],
  ['nous-research', 'Nous Research (Hermes)', 'frontier', '#2563EB', 'NO', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://inference-api.nousresearch.com/v1', 'https://portal.nousresearch.com', ['Hermes-3-Llama-3.1-70B', 'DeepHermes-3-Llama-3-8B-Preview'], 'Nous Research Hermes 3 & DeepHermes reasoning API'],
  ['arcee-ai', 'Arcee AI', 'frontier', '#8B5CF6', 'AR', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://conductor.arcee.ai/v1', 'https://app.arcee.ai', ['arcee-blitz', 'virtuoso-large'], 'Arcee Conductor small-language-model router & Virtuoso'],
  ['inception', 'Inception Labs (Mercury)', 'frontier', '#F97316', 'IN', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.inceptionlabs.ai/v1', 'https://platform.inceptionlabs.ai', ['mercury-coder-small'], 'Mercury diffusion-based ultra-fast coding LLM (1,000+ tok/s)'],
  ['venice', 'Venice.ai (Uncensored)', 'frontier', '#0EA5E9', 'VN', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.venice.ai/api/v1', 'https://venice.ai', ['llama-3.3-70b', 'deepseek-r1-671b'], 'Privacy-first zero-data-retention Venice API'],
  ['blackbox', 'Blackbox AI API', 'frontier', '#1A1A2E', 'BB', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.blackbox.ai/v1', 'https://www.blackbox.ai', ['blackboxai-pro'], 'Blackbox coding assistant API'],
  ['morph', 'Morph Fast Apply', 'frontier', '#2563EB', 'MP', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.morphllm.com/v1', 'https://morphllm.com', ['morph-v3-large', 'morph-v3-fast'], 'Ultra-fast code diff & patch application model'],
  ['pioneer', 'Pioneer AI', 'frontier', '#7C5CFF', 'PN', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.pioneer.ai/v1', 'https://pioneer.ai', ['pioneer-1'], 'Pioneer frontier inference API'],
  ['galadriel', 'Galadriel', 'frontier', '#F59E0B', 'GA', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.galadriel.com/v1', 'https://galadriel.com', ['llama3.1:70b'], 'Verifiable decentralized AI inference host'],

  // ============================================================================
  // 4. INFERENCE HOSTS — FAST CLOUD GPU (29 Providers)
  // ============================================================================
  ['groq', 'Groq Cloud LPU', 'inference', '#F55036', 'GQ', 'api_key', 'free', 'safe', 'openai-chat', 'https://api.groq.com/openai/v1', 'https://console.groq.com', ['llama-3.3-70b-versatile', 'deepseek-r1-distill-llama-70b', 'qwen-qwq-32b'], '500–1,000+ tok/s LPU inference with generous Free Developer Tier'],
  ['cerebras', 'Cerebras Wafer-Scale', 'inference', '#FF4F00', 'CB', 'api_key', 'free', 'safe', 'openai-chat', 'https://api.cerebras.ai/v1', 'https://cloud.cerebras.ai', ['qwen-2.5-coder-32b', 'llama-3.3-70b', 'llama3.1-8b'], '2,200+ tok/s Wafer-Scale Engine with 1M daily free tokens'],
  ['sambanova', 'SambaNova Cloud', 'inference', '#DC2626', 'SN', 'api_key', 'free', 'safe', 'openai-chat', 'https://api.sambanova.ai/v1', 'https://cloud.sambanova.ai', ['DeepSeek-R1', 'Meta-Llama-3.3-70B-Instruct', 'Qwen2.5-Coder-32B-Instruct'], 'SambaNova RDU ultra-fast inference with free developer tier'],
  ['together', 'Together AI', 'inference', '#0F6FFF', 'TG', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.together.xyz/v1', 'https://api.together.ai', ['deepseek-ai/DeepSeek-R1', 'meta-llama/Llama-3.3-70B-Instruct-Turbo', 'Qwen/Qwen2.5-Coder-32B-Instruct'], 'Leading open-weights GPU cloud with free Llama/Vision endpoints'],
  ['fireworks', 'Fireworks AI', 'inference', '#7B2EF2', 'FW', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.fireworks.ai/inference/v1', 'https://fireworks.ai', ['accounts/fireworks/models/deepseek-r1', 'accounts/fireworks/models/llama-v3p3-70b-instruct'], 'Low-latency FireAttention serverless & compound AI host'],
  ['nvidia', 'NVIDIA NIM (build.nvidia.com)', 'inference', '#76B900', 'NV', 'api_key', 'free', 'safe', 'openai-chat', 'https://integrate.api.nvidia.com/v1', 'https://build.nvidia.com', ['deepseek-ai/deepseek-r1', 'meta/llama-3.3-70b-instruct', 'qwen/qwen2.5-coder-32b-instruct'], 'NVIDIA NIM microservices with generous free developer credits'],
  ['deepinfra', 'DeepInfra', 'inference', '#2563EB', 'DI', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.deepinfra.com/v1/openai', 'https://deepinfra.com', ['deepseek-ai/DeepSeek-R1', 'meta-llama/Llama-3.3-70B-Instruct'], 'Low-cost serverless open-source model hosting'],
  ['hyperbolic', 'Hyperbolic', 'inference', '#00D4FF', 'HY', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.hyperbolic.xyz/v1', 'https://app.hyperbolic.xyz', ['deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-Coder-32B-Instruct'], 'Decentralized GPU inference cloud with free signup credits'],
  ['nebius', 'Nebius AI Studio', 'inference', '#6C5CE7', 'NB', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.studio.nebius.ai/v1', 'https://studio.nebius.com', ['deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-Coder-32B-Instruct'], 'European H100/H200 inference cloud with trial credits'],
  ['siliconflow', 'SiliconFlow', 'inference', '#5B6EF5', 'SF', 'api_key', 'free', 'safe', 'openai-chat', 'https://api.siliconflow.cn/v1', 'https://cloud.siliconflow.cn', ['deepseek-ai/DeepSeek-R1', 'Qwen/Qwen2.5-Coder-32B-Instruct', 'Qwen/Qwen2.5-7B-Instruct'], 'High-speed inference with free 7B/9B models & DeepSeek R1'],
  ['novita', 'Novita AI', 'inference', '#FF4081', 'NV', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.novita.ai/v3/openai', 'https://novita.ai', ['deepseek/deepseek-r1', 'meta-llama/llama-3.3-70b-instruct'], 'Serverless LLM & image generation cloud'],
  ['chutes', 'Chutes.ai (Bittensor)', 'inference', '#06B6D4', 'CH', 'api_key', 'free', 'safe', 'openai-chat', 'https://llm.chutes.ai/v1', 'https://chutes.ai', ['deepseek-ai/DeepSeek-R1', 'deepseek-ai/DeepSeek-V3'], 'Serverless Bittensor subnet inference with generous free tier'],
  ['featherless-ai', 'Featherless AI', 'inference', '#EA580C', 'FL', 'api_key', 'subscription', 'safe', 'openai-chat', 'https://api.featherless.ai/v1', 'https://featherless.ai', ['Qwen/Qwen2.5-72B-Instruct', 'meta-llama/Llama-3.3-70B-Instruct'], 'Flat-rate unlimited HuggingFace model inference'],
  ['baseten', 'Baseten', 'inference', '#111827', 'BT', 'api_key', 'paid', 'safe', 'openai-chat', 'https://bridge.baseten.co/v1/direct', 'https://baseten.co', ['deepseek-r1', 'llama-3.3-70b'], 'Truss-powered dedicated & serverless GPU inference'],
  ['friendliai', 'FriendliAI', 'inference', '#EC4899', 'FR', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.friendli.ai/serverless/v1', 'https://friendli.ai', ['meta-llama-3.3-70b-instruct', 'deepseek-r1'], 'High-efficiency serverless LLM engine'],
  ['lambda-ai', 'Lambda Labs Inference', 'inference', '#7C3AED', 'LA', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.lambdalabs.com/v1', 'https://lambdalabs.com', ['deepseek-r1-671b', 'llama3.3-70b-instruct-fp8'], 'Lambda GPU cloud OpenAI-compatible inference API'],
  ['huggingface', 'HuggingFace Inference Providers', 'inference', '#FFD21E', 'HF', 'api_key', 'free', 'safe', 'openai-chat', 'https://router.huggingface.co/v1', 'https://huggingface.co/settings/tokens', ['Qwen/Qwen2.5-Coder-32B-Instruct', 'deepseek-ai/DeepSeek-R1'], 'HuggingFace Hub unified inference router with free monthly quota'],
  ['ollama-cloud', 'Ollama Cloud', 'inference', '#58A6FF', 'OC', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.ollama.com/v1', 'https://ollama.com', ['llama3.3:70b', 'qwen2.5-coder:32b'], 'Hosted Ollama Cloud endpoint'],
  ['nscale', 'nScale', 'inference', '#0891B2', 'NS', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://inference.api.nscale.com/v1', 'https://nscale.com', ['meta-llama/Llama-3.3-70B-Instruct'], 'Sovereign green GPU cloud inference'],
  ['publicai', 'PublicAI', 'inference', '#059669', 'PA', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.publicai.co/v1', 'https://publicai.co', ['llama-3.3-70b-instruct'], 'PublicAI distributed inference host'],
  ['wandb', 'Weights & Biases Inference (CoreWeave)', 'inference', '#FFBE0B', 'WB', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.inference.wandb.ai/v1', 'https://wandb.ai', ['deepseek-ai/DeepSeek-R1', 'meta-llama/Llama-3.3-70B-Instruct'], 'W&B Weave + CoreWeave serverless inference'],
  ['inference-net', 'Inference.net', 'inference', '#2563EB', 'IN', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.inference.net/v1', 'https://inference.net', ['meta-llama/llama-3.3-70b-instruct/fp-8'], 'Ultra-low-cost distributed GPU inference'],
  ['predibase', 'Predibase', 'inference', '#0F766E', 'PB', 'api_key', 'paid', 'safe', 'openai-chat', 'https://serving.app.predibase.com/v1', 'https://predibase.com', ['solar-1-mini-chat-240612'], 'LoRAX multi-adapter serverless inference'],
  ['modelscope', 'ModelScope API-Inference', 'inference', '#FF6A00', 'MS', 'api_key', 'free', 'safe', 'openai-chat', 'https://api-inference.modelscope.cn/v1', 'https://modelscope.cn', ['Qwen/Qwen2.5-Coder-32B-Instruct', 'deepseek-ai/DeepSeek-R1'], 'Alibaba ModelScope free developer inference (2,000 calls/day)'],
  ['byteplus', 'BytePlus ModelArk', 'inference', '#2563EB', 'BP', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://ark.ap-southeast.bytepluses.com/api/v3', 'https://www.byteplus.com', ['deepseek-r1-250120', 'skylark-pro'], 'BytePlus international ModelArk inference'],
  ['monsterapi', 'MonsterAPI', 'inference', '#EF4444', 'MA', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://llm.monsterapi.ai/v1', 'https://monsterapi.ai', ['meta-llama/Meta-Llama-3.1-70B-Instruct'], 'Decentralized GPU LLM gateway'],
  ['bytez', 'Bytez', 'inference', '#6366F1', 'BZ', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.bytez.com/models/v2/openai/v1', 'https://bytez.com', ['Qwen/Qwen2.5-7B-Instruct'], 'Serverless open-model hub'],
  ['nube', 'Nube.sh', 'inference', '#2563EB', 'NU', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.nube.sh/v1', 'https://nube.sh', ['llama-3.3-70b'], 'Nube high-speed inference'],
  ['poolside', 'Poolside AI', 'inference', '#111827', 'PS', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.poolside.ai/v1', 'https://poolside.ai', ['malibu', 'point'], 'Poolside RLCEF software engineering models'],

  // ============================================================================
  // 5. AI GATEWAYS & AGGREGATORS (45 Providers)
  // ============================================================================
  ['openrouter', 'OpenRouter', 'gateways', '#F97316', 'OR', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://openrouter.ai/api/v1', 'https://openrouter.ai', ['deepseek/deepseek-r1:free', 'anthropic/claude-sonnet-4-6', 'google/gemini-2.5-pro'], '300+ models + `:free` model pool with unified OpenAI API'],
  ['github-models', 'GitHub Models (Azure AI)', 'gateways', '#24292F', 'GM', 'api_key', 'free', 'safe', 'openai-chat', 'https://models.inference.ai.azure.com', 'https://github.com/marketplace/models', ['gpt-4o', 'o3-mini', 'DeepSeek-R1', 'Llama-3.3-70B-Instruct'], 'Free developer playground powered by GitHub PAT & Azure AI'],
  ['requesty', 'Requesty Router', 'gateways', '#6366F1', 'RQ', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://router.requesty.ai/v1', 'https://requesty.ai', ['anthropic/claude-sonnet-4-6', 'openai/gpt-4o'], 'Smart LLM router for Claude Code, Cline, and Roo Code'],
  ['vercel-ai-gateway', 'Vercel AI Gateway', 'gateways', '#111827', 'VAI', 'api_key', 'paid', 'safe', 'openai-chat', 'https://ai-gateway.vercel.sh/v1', 'https://vercel.com/ai', ['anthropic/claude-sonnet-4-6', 'openai/gpt-4o'], 'Vercel unified edge AI gateway'],
  ['poe', 'Poe Official API', 'gateways', '#F97316', 'PO', 'api_key', 'subscription', 'safe', 'openai-chat', 'https://api.poe.com/v1', 'https://poe.com/api_key', ['Claude-3.7-Sonnet', 'GPT-4o', 'DeepSeek-R1'], 'Use your Poe subscription points via OpenAI-compatible API'],
  ['aimlapi', 'AI/ML API', 'gateways', '#6366F1', 'AI', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.aimlapi.com/v1', 'https://aimlapi.com', ['claude-sonnet-4-6', 'gpt-4o', 'deepseek-r1'], '200+ AI models under one API key'],
  ['nanogpt', 'NanoGPT', 'gateways', '#4F46E5', 'NG', 'api_key', 'paid', 'safe', 'openai-chat', 'https://nano-gpt.com/api/v1', 'https://nano-gpt.com', ['claude-sonnet-4-6', 'gpt-4o', 'deepseek-r1'], 'Pay-per-prompt privacy-preserving LLM aggregator'],
  ['electronhub', 'Electron Hub', 'gateways', '#22C55E', 'EH', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.electronhub.top/v1', 'https://electronhub.top', ['claude-sonnet-4-6', 'gpt-4o', 'deepseek-r1'], 'Community multi-model API gateway with daily free credits'],
  ['routeway', 'Routeway', 'gateways', '#F59E0B', 'RW', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.routeway.ai/v1', 'https://routeway.ai', ['claude-sonnet-4-6', 'gpt-4o'], 'Multi-provider AI routing gateway'],
  ['llmgateway', 'LLM Gateway', 'gateways', '#6366F1', 'LG', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.llmgateway.io/v1', 'https://llmgateway.io', ['gpt-4o', 'claude-sonnet-4-6'], 'Open-source LLM gateway cloud'],
  ['kilo-gateway', 'Kilo Gateway', 'gateways', '#617A91', 'KG', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.kilocode.ai/v1', 'https://kilocode.ai', ['claude-sonnet-4-6', 'gemini-2.5-pro'], 'Kilo unified coding model gateway'],
  ['synthetic', 'Synthetic API', 'gateways', '#6366F1', 'SY', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.synthetic.new/openai/v1', 'https://synthetic.new', ['deepseek-r1', 'llama-3.3-70b'], 'Synthetic data & high-throughput model gateway'],
  ['opper', 'Opper AI', 'gateways', '#6366F1', 'OP', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.opper.ai/compat/openai/v1', 'https://opper.ai', ['openai/gpt-4o', 'anthropic/claude-sonnet-4-6'], 'Structured reliability & tracing gateway'],
  ['naga-ai', 'Naga AI', 'gateways', '#059669', 'NA', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.naga.ac/v1', 'https://naga.ac', ['gpt-4o', 'claude-sonnet-4-6'], 'Naga AI unified model proxy'],
  ['api-airforce', 'Api.airforce', 'gateways', '#1E3A5F', 'AF', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.airforce/v1', 'https://api.airforce', ['claude-sonnet-4-6', 'gpt-4o', 'deepseek-r1'], 'High-speed multi-model aggregator with free tier'],
  ['llm7', 'LLM7.io', 'gateways', '#6366F1', 'LM7', 'api_key', 'free', 'safe', 'openai-chat', 'https://api.llm7.io/v1', 'https://llm7.io', ['gpt-4o-mini', 'deepseek-r1'], 'Free & anonymous OpenAI-compatible research gateway'],
  ['g4f-groq', 'g4f.space — Groq', 'gateways', '#F97316', 'G4F', 'api_key', 'free', 'caution', 'openai-chat', 'https://g4f.space/api/groq/v1', 'https://g4f.space', ['llama-3.3-70b-versatile'], 'GPT4Free hosted Groq proxy'],
  ['g4f-gemini', 'g4f.space — Gemini', 'gateways', '#F97316', 'G4F', 'api_key', 'free', 'caution', 'openai-chat', 'https://g4f.space/api/gemini/v1', 'https://g4f.space', ['gemini-2.5-flash'], 'GPT4Free hosted Gemini proxy'],
  ['g4f-pollinations', 'g4f.space — Pollinations', 'gateways', '#F97316', 'G4F', 'api_key', 'free', 'caution', 'openai-chat', 'https://g4f.space/api/pollinations/v1', 'https://g4f.space', ['openai', 'deepseek-r1'], 'GPT4Free hosted Pollinations proxy'],
  ['g4f-nvidia', 'g4f.space — NVIDIA', 'gateways', '#F97316', 'G4F', 'api_key', 'free', 'caution', 'openai-chat', 'https://g4f.space/api/nvidia/v1', 'https://g4f.space', ['deepseek-r1'], 'GPT4Free hosted NVIDIA NIM proxy'],
  ['chatanywhere', 'ChatAnywhere', 'gateways', '#2563EB', 'CA', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.chatanywhere.tech/v1', 'https://chatanywhere.tech', ['gpt-4o-mini', 'gpt-4o', 'deepseek-r1'], 'Popular free/paid OpenAI mirror gateway (200 free reqs/day)'],
  ['laozhang', 'LaoZhang AI', 'gateways', '#FF1744', 'LZ', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.laozhang.ai/v1', 'https://api.laozhang.ai', ['claude-sonnet-4-6', 'gpt-4o'], 'Multi-model enterprise relay gateway'],
  ['piapi', 'PiAPI', 'gateways', '#7C4DFF', 'PI', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.piapi.ai/v1', 'https://piapi.ai', ['gpt-4o', 'claude-sonnet-4-6'], 'Unified generative AI & media gateway'],
  ['getgoapi', 'GoAPI', 'gateways', '#FF6D00', 'GO', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.goapi.ai/v1', 'https://goapi.ai', ['gpt-4o', 'claude-sonnet-4-6'], 'GoAPI multi-model gateway'],
  ['fastrouter', 'FastRouter', 'gateways', '#F97316', 'FR', 'api_key', 'paid', 'safe', 'openai-chat', 'https://go.fastrouter.ai/api/v1', 'https://fastrouter.ai', ['anthropic/claude-sonnet-4-6', 'openai/gpt-4o'], 'Low-latency LLM router'],
  ['agentrouter', 'AgentRouter', 'gateways', '#10B981', 'AR', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.agentrouter.org/v1', 'https://agentrouter.org', ['claude-sonnet-4-6', 'gpt-4o'], 'Agentic tool-calling router'],
  ['unorouter', 'UnoRouter', 'gateways', '#8B5CF6', 'UR', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.unorouter.ai/v1', 'https://unorouter.ai', ['gpt-4o', 'claude-sonnet-4-6'], 'Unified AI gateway'],
  ['literouter', 'LiteRouter', 'gateways', '#2563EB', 'LR', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.literouter.com/v1', 'https://literouter.com', ['gpt-4o-mini', 'deepseek-r1'], 'Lightweight model aggregator'],
  ['eurouter', 'EURouter (EU Sovereign)', 'gateways', '#1D4ED8', 'EUR', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.eurouter.ai/v1', 'https://eurouter.ai', ['mistral-large-latest', 'claude-sonnet-4-6'], 'GDPR-compliant European AI router'],
  ['greenpt', 'GreenPT (Sustainable AI)', 'gateways', '#15803D', 'GPT', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.greenpt.ai/v1', 'https://greenpt.ai', ['llama-3.3-70b'], '100% renewable-energy European AI gateway'],
  ['meganova-ai', 'MegaNova AI', 'gateways', '#7C3AED', 'MN', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.meganova.ai/v1', 'https://meganova.ai', ['claude-sonnet-4-6', 'deepseek-r1'], 'MegaNova multi-provider gateway'],
  ['void-ai', 'Void AI', 'gateways', '#111827', 'VA', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.voidai.app/v1', 'https://voidai.app', ['claude-sonnet-4-6', 'gpt-4o'], 'Void AI developer gateway'],
  ['zenmux', 'ZenMux', 'gateways', '#7C3AED', 'ZM', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.zenmux.ai/v1', 'https://zenmux.ai', ['claude-sonnet-4-6', 'gpt-4o'], 'ZenMux multiplexing LLM gateway'],
  ['freemodel-dev', 'FreeModel.dev', 'gateways', '#8B5CF6', 'FM', 'api_key', 'free', 'safe', 'openai-chat', 'https://api.freemodel.dev/v1', 'https://freemodel.dev', ['deepseek-r1', 'llama-3.3-70b'], 'Free developer model router'],
  ['freeinference', 'FreeInference', 'gateways', '#8B5CF6', 'FI', 'api_key', 'free', 'safe', 'openai-chat', 'https://api.freeinference.org/v1', 'https://freeinference.org', ['llama-3.3-70b'], 'Community free inference gateway'],
  ['freetheai', 'FreeTheAi', 'gateways', '#22C55E', 'FTA', 'api_key', 'free', 'safe', 'openai-chat', 'https://api.freetheai.org/v1', 'https://freetheai.org', ['deepseek-r1'], 'Open-access AI router'],
  ['orcarouter', 'OrcaRouter', 'gateways', '#0891B2', 'ORC', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.orcarouter.ai/v1', 'https://orcarouter.ai', ['claude-sonnet-4-6', 'gpt-4o'], 'Orca multi-provider router'],
  ['crof', 'CrofAI', 'gateways', '#0EA5E9', 'CR', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://ai.nahcrof.com/v2', 'https://nahcrof.com', ['deepseek-r1', 'llama-3.3-70b'], 'CrofAI low-cost inference gateway'],
  ['opencode-zen', 'OpenCode Zen', 'gateways', '#6366F1', 'OCZ', 'api_key', 'subscription', 'safe', 'openai-chat', 'https://api.opencode.ai/v1', 'https://opencode.ai', ['claude-sonnet-4-6', 'gpt-4o'], 'OpenCode Zen coding gateway'],
  ['gitlawb', 'Gitlawb Opengateway', 'gateways', '#10B981', 'GLB', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.gitlawb.com/v1', 'https://gitlawb.com', ['mimo-vl-7b', 'deepseek-r1'], 'Gitlawb MiMo & GMI Cloud open gateway'],
  ['qiniu', 'Qiniu Cloud AI', 'gateways', '#1E88E5', 'QN', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.qnaigc.com/v1', 'https://www.qiniu.com', ['deepseek-r1', 'deepseek-v3'], 'Qiniu AIGC inference gateway'],
  ['beatapi', 'BeatAPI', 'gateways', '#EC4899', 'BT', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.beatapi.com/v1', 'https://beatapi.com', ['gpt-4o', 'claude-sonnet-4-6'], 'BeatAPI multi-provider gateway'],
  ['unifically', 'Unifically', 'gateways', '#6366F1', 'UF', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.unifically.com/v1', 'https://unifically.com', ['claude-sonnet-4-6', 'gpt-4o'], 'Unifically unified LLM gateway'],
  ['onomeo', 'Onomeo', 'gateways', '#14B8A6', 'ON', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.onomeo.com/v1', 'https://onomeo.com', ['gpt-4o', 'deepseek-r1'], 'Onomeo AI gateway'],
  ['helicone', 'Helicone AI Gateway', 'gateways', '#0EA5E9', 'HC', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://oai.helicone.ai/v1', 'https://helicone.ai', ['gpt-4o', 'claude-sonnet-4-6'], 'Helicone observability & caching gateway'],

  // ============================================================================
  // 6. REGIONAL, CHINA & SOVEREIGN LABS (35 Providers)
  // ============================================================================
  ['deepseek', 'DeepSeek Official', 'regional', '#4D6BFE', 'DS', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.deepseek.com/v1', 'https://platform.deepseek.com', ['deepseek-reasoner', 'deepseek-chat'], 'Official DeepSeek V3 & R1 API with native KV Context Caching'],
  ['zai', 'Z.AI (Global GLM)', 'regional', '#2563EB', 'ZA', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.z.ai/api/paas/v4', 'https://z.ai', ['glm-4.5', 'glm-4-plus', 'glm-4-flash'], 'Zhipu Z.AI global platform (includes free `glm-4-flash`)'],
  ['glm', 'GLM Coding Plan', 'regional', '#2563EB', 'GL', 'api_key', 'subscription', 'safe', 'openai-chat', 'https://open.bigmodel.cn/api/coding/paas/v4', 'https://open.bigmodel.cn', ['glm-4.5', 'glm-zero-preview'], 'Zhipu GLM Coding Plan high-quota API'],
  ['bigmodel', 'BigModel.cn (Zhipu AI)', 'regional', '#2563EB', 'BM', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://open.bigmodel.cn/api/paas/v4', 'https://open.bigmodel.cn', ['glm-4-flash', 'glm-4-plus', 'glm-zero-preview'], 'Zhipu AI BigModel platform with 100% free `glm-4-flash`'],
  ['moonshot', 'Kimi (Moonshot AI)', 'regional', '#1E40AF', 'MS', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.moonshot.ai/v1', 'https://platform.moonshot.ai', ['kimi-k2-0711-preview', 'moonshot-v1-128k'], 'Moonshot AI Kimi K2 1T-MoE & long-context API'],
  ['kimi-coding-apikey', 'Kimi Code API Key', 'regional', '#1E40AF', 'KC', 'api_key', 'subscription', 'safe', 'openai-chat', 'https://api.kimi.com/coding/v1', 'https://www.kimi.ai/code', ['kimi-for-coding'], 'Kimi Coding Plan dedicated API key endpoint'],
  ['alibaba', 'Alibaba Cloud Model Studio (Intl)', 'regional', '#FF6600', 'AL', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', 'https://modelstudio.console.alibabacloud.com', ['qwen-max', 'qwen-plus', 'qwen2.5-coder-32b-instruct'], 'Alibaba Cloud DashScope International with 1M free token quota per model'],
  ['alibaba-cn', 'Alibaba DashScope (China)', 'regional', '#FF6600', 'ACN', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://dashscope.aliyuncs.com/compatible-mode/v1', 'https://bailian.console.aliyun.com', ['qwen-max', 'qwen-coder-plus', 'qwq-32b'], 'Aliyun Bailian / DashScope CN endpoint'],
  ['bailian-coding-plan', 'Alibaba Bailian Token Plan', 'regional', '#FF6A00', 'BCP', 'api_key', 'subscription', 'safe', 'openai-chat', 'https://coding.dashscope.aliyuncs.com/v1', 'https://bailian.console.aliyun.com', ['qwen-coder-plus', 'qwen-max'], 'Alibaba Bailian Coding Token Plan'],
  ['qwen-cloud', 'Qwen Cloud Portal', 'regional', '#615CED', 'QC', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://portal.qwen.ai/v1', 'https://chat.qwen.ai', ['qwen-max', 'qwen-2.5-coder-32b'], 'Qwen Cloud direct API'],
  ['minimax', 'MiniMax (Hailuo Intl)', 'regional', '#7C3AED', 'MM', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.minimaxi.chat/v1', 'https://platform.minimaxi.com', ['MiniMax-Text-01', 'abab6.5s-chat'], 'MiniMax-01 4M-token Lightning Attention API'],
  ['minimax-cn', 'MiniMax (China)', 'regional', '#DC2626', 'MC', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.minimax.chat/v1', 'https://platform.minimaxi.com', ['MiniMax-Text-01'], 'MiniMax China mainland API'],
  ['volcengine', 'Volcengine Ark (ByteDance)', 'regional', '#DC2626', 'VE', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://ark.cn-beijing.volces.com/api/v3', 'https://console.volcengine.com/ark', ['doubao-1-5-pro-32k-250115', 'deepseek-r1-250120'], 'ByteDance Volcengine Ark Doubao 1.5 Pro & DeepSeek R1'],
  ['volcengine-coding-plan', 'Volcengine Ark Coding Plan', 'regional', '#FF6A00', 'VC', 'api_key', 'subscription', 'safe', 'openai-chat', 'https://ark.cn-beijing.volces.com/api/coding/v3', 'https://console.volcengine.com/ark', ['doubao-1-5-pro-coding'], 'Volcengine Ark Coding subscription endpoint'],
  ['doubao', 'Doubao Direct', 'regional', '#FE2C55', 'DB', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://ark.cn-beijing.volces.com/api/v3', 'https://www.doubao.com', ['doubao-1-5-pro-256k'], 'ByteDance Doubao 1.5 frontier models'],
  ['qianfan', 'Baidu Qianfan (ERNIE)', 'regional', '#2468F2', 'BD', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://qianfan.baidubce.com/v2', 'https://console.bce.baidu.com/qianfan', ['ernie-4.5-8k-preview', 'ernie-x1-32k', 'ernie-speed-128k'], 'Baidu Wenxin Qianfan v2 API (ERNIE Speed is 100% free)'],
  ['tencent', 'Tencent Hunyuan', 'regional', '#07C160', 'TC', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.hunyuan.cloud.tencent.com/v1', 'https://cloud.tencent.com/product/hunyuan', ['hunyuan-turbos-latest', 'hunyuan-t1-latest', 'hunyuan-lite'], 'Tencent Hunyuan T1 & TurboS (`hunyuan-lite` is free)'],
  ['stepfun', 'StepFun (Step-2)', 'regional', '#8B5CF6', 'SF', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.stepfun.com/v1', 'https://platform.stepfun.com', ['step-2-16k', 'step-r1-v-mini'], 'StepFun multimodal & reasoning frontier lab'],
  ['yi', 'Yi (01.AI)', 'regional', '#10B981', 'YI', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.lingyiwanwu.com/v1', 'https://platform.lingyiwanwu.com', ['yi-lightning', 'yi-medium'], 'Kai-Fu Lee 01.AI Yi-Lightning fast MoE API'],
  ['baichuan', 'Baichuan AI', 'regional', '#6366F1', 'BC', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.baichuan-ai.com/v1', 'https://platform.baichuan-ai.com', ['Baichuan4-Turbo', 'Baichuan-M1'], 'Baichuan-4 & medical specialist models'],
  ['sensenova', 'SenseNova (SenseTime)', 'regional', '#0066FF', 'SN', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.sensenova.cn/compatible-mode/v1', 'https://platform.sensenova.cn', ['SenseChat-5', 'SenseChat-Turbo'], 'SenseTime SenseNova V5 multimodal API'],
  ['sparkdesk', 'iFlyTek SparkDesk', 'regional', '#0066FF', 'SD', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://spark-api-open.xf-yun.com/v1', 'https://xinghuo.xfyun.cn', ['4.0Ultra', 'generalv3.5', 'lite'], 'iFlyTek Spark 4.0 Ultra (`lite` model is 100% free)'],
  ['internlm', 'InternLM (Shanghai AI Lab)', 'regional', '#4F46E5', 'IL', 'api_key', 'free', 'safe', 'openai-chat', 'https://chat.intern-ai.org.cn/api/v1', 'https://internlm.intern-ai.org.cn', ['internlm3-8b-instruct', 'internvl2.5-latest'], 'Shanghai AI Lab Puyu InternLM3 free research API'],
  ['xiaomi-mimo', 'Xiaomi MiMo', 'regional', '#EA580C', 'MM', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.xiaomimimo.com/v1', 'https://mimo.xiaomi.com', ['mimo-7b-rl'], 'Xiaomi MiMo reasoning specialist model'],
  ['longcat', 'LongCat AI (Meituan)', 'regional', '#FF6B9D', 'LC', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.longcat.chat/v1', 'https://longcat.chat', ['longcat-large'], 'LongCat conversational & coding LLM'],
  ['ant-ling', 'Ant Ling / Ring (inclusionAI)', 'regional', '#1677FF', 'AL', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.inclusion.ai/v1', 'https://inclusion.ai', ['ling-plus', 'ring-lite'], 'Ant Group Ling & Ring MoE models'],
  ['coze', 'Coze (ByteDance Bot API)', 'regional', '#3B82F6', 'CZ', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.coze.com/open_api/v2', 'https://www.coze.com', ['coze-agent'], 'Coze AI agent & workflow API'],
  ['gigachat', 'GigaChat (Sber)', 'regional', '#10B981', 'GC', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://gigachat.devices.sberbank.ru/api/v1', 'https://developers.sber.ru', ['GigaChat-Pro', 'GigaChat-Max'], 'Sber GigaChat sovereign LLM API'],
  ['sarvam', 'Sarvam AI (India)', 'regional', '#0EA5E9', 'SV', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.sarvam.ai/v1', 'https://www.sarvam.ai', ['sarvam-m', 'sarvam-2b'], 'Indic sovereign AI lab for voice & chat'],
  ['sealion', 'SEA-LION (AI Singapore)', 'regional', '#0D9488', 'SL', 'api_key', 'free', 'safe', 'openai-chat', 'https://api.sea-lion.ai/v1', 'https://sea-lion.ai', ['aisingapore/Llama-SEA-LION-v3-70B-IT'], 'Southeast Asian languages sovereign LLM (Indonesian, Malay, Thai, Vietnamese)'],
  ['typhoon', 'Typhoon (SCB 10X)', 'regional', '#7C3AED', 'TY', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.opentyphoon.ai/v1', 'https://opentyphoon.ai', ['typhoon-v2-70b-instruct', 'typhoon-v2-r1-70b'], 'Southeast Asian Typhoon v2 & R1 API'],
  ['clova-studio', 'Naver CLOVA Studio (HyperCLOVA X)', 'regional', '#03C75A', 'CS', 'api_key', 'paid', 'safe', 'openai-chat', 'https://clovastudio.stream.ntruss.com/v1/openai', 'https://clova.ai', ['HCX-003', 'HCX-DASH-001'], 'Naver HyperCLOVA X Korean sovereign LLM'],
  ['plamo', 'PLaMo (Preferred Networks Japan)', 'regional', '#DC2626', 'PL', 'api_key', 'paid', 'safe', 'openai-chat', 'https://platform.preferredai.jp/api/completion/v1', 'https://www.preferred.jp', ['plamo-2.0-prime'], 'Preferred Networks Japanese sovereign LLM'],
  ['maritalk', 'Maritaca AI (Sabiá Brazil)', 'regional', '#1D4ED8', 'MT', 'api_key', 'paid', 'safe', 'openai-chat', 'https://chat.maritaca.ai/api', 'https://www.maritaca.ai', ['sabia-3', 'sabiazinho-3'], 'Portuguese sovereign LLM Sabiá-3'],
  ['360ai', '360 Zhinao AI', 'regional', '#00B96B', '360', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.360.cn/v1', 'https://ai.360.cn', ['360gpt-pro', '360gpt-turbo'], '360 Zhinao LLM API'],

  // ============================================================================
  // 7. ENTERPRISE CLOUD (16 Providers)
  // ============================================================================
  ['workers-ai', 'Cloudflare Workers AI', 'enterprise', '#F48120', 'CF', 'workers_ai', 'free', 'safe', 'workers-ai', 'binding://env.AI', 'https://developers.cloudflare.com/workers-ai/', ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', '@cf/baai/bge-m3'], '100% Native Cloudflare `env.AI` binding (Zero network hop + 10,000 free Neurons/day)'],
  ['vertex', 'Google Cloud Vertex AI', 'enterprise', '#4285F4', 'VA', 'service_account', 'paid', 'safe', 'gemini', 'https://aiplatform.googleapis.com', 'https://cloud.google.com/vertex-ai', ['gemini-2.5-pro', 'gemini-2.5-flash', 'claude-sonnet-4-6'], 'Enterprise Vertex AI with WebCrypto RS256 Service Account JWT signing'],
  ['vertex-partner', 'Vertex AI Model Garden (Anthropic/Llama)', 'enterprise', '#34A853', 'VP', 'service_account', 'paid', 'safe', 'openai-chat', 'https://us-central1-aiplatform.googleapis.com/v1beta1/openai', 'https://cloud.google.com/model-garden', ['claude-sonnet-4-6@20250514', 'meta/llama-3.3-70b-instruct-maas'], 'Vertex AI Model Garden OpenAI-compatible MaaS endpoint'],
  ['azure-openai', 'Azure OpenAI Service', 'enterprise', '#0078D4', 'AZ', 'api_key', 'paid', 'safe', 'openai-chat', 'https://YOUR_RESOURCE.openai.azure.com/openai/v1', 'https://azure.microsoft.com/en-us/products/ai-services/openai-service', ['gpt-4o', 'o3-mini'], 'Microsoft Azure OpenAI enterprise deployment'],
  ['azure-ai', 'Azure AI Foundry (Model Catalog)', 'enterprise', '#2563EB', 'AF', 'api_key', 'paid', 'safe', 'openai-chat', 'https://YOUR_ENDPOINT.services.ai.azure.com/models', 'https://ai.azure.com', ['DeepSeek-R1', 'Llama-3.3-70B-Instruct', 'Mistral-Large-2411'], 'Azure AI Foundry serverless model inference'],
  ['bedrock', 'Amazon Bedrock', 'enterprise', '#FF9900', 'BR', 'api_key', 'paid', 'safe', 'openai-chat', 'https://bedrock-runtime.us-east-1.amazonaws.com/openai/v1', 'https://aws.amazon.com/bedrock/', ['anthropic.claude-sonnet-4-6-v1:0', 'us.deepseek.r1-v1:0'], 'AWS Bedrock Mantle OpenAI-compatible & SigV4 endpoint'],
  ['databricks', 'Databricks Mosaic AI Serving', 'enterprise', '#F97316', 'DB', 'api_key', 'paid', 'safe', 'openai-chat', 'https://YOUR_WORKSPACE.cloud.databricks.com/serving-endpoints', 'https://www.databricks.com/product/machine-learning', ['databricks-claude-3-7-sonnet', 'databricks-meta-llama-3-3-70b-instruct'], 'Databricks Foundation Model APIs'],
  ['snowflake', 'Snowflake Cortex AI', 'enterprise', '#29B5E8', 'SF', 'api_key', 'paid', 'safe', 'openai-chat', 'https://YOUR_ACCOUNT.snowflakecomputing.com/api/v2/cortex/inference', 'https://www.snowflake.com/en/data-cloud/cortex/', ['claude-3-5-sonnet', 'deepseek-r1', 'llama3.3-70b'], 'Snowflake Cortex REST inference'],
  ['watsonx', 'IBM watsonx.ai Gateway', 'enterprise', '#0F62FE', 'WX', 'api_key', 'paid', 'safe', 'openai-chat', 'https://us-south.ml.cloud.ibm.com/ml/gateway/v1', 'https://www.ibm.com/watsonx', ['ibm/granite-3-8b-instruct', 'meta-llama/llama-3-3-70b-instruct'], 'IBM watsonx.ai enterprise model gateway'],
  ['oci', 'Oracle OCI Generative AI', 'enterprise', '#C74634', 'OCI', 'api_key', 'paid', 'safe', 'openai-chat', 'https://inference.generativeai.us-chicago-1.oci.oraclecloud.com/20231130/actions/v1', 'https://www.oracle.com/artificial-intelligence/generative-ai/', ['cohere.command-r-plus', 'meta.llama-3.3-70b-instruct'], 'Oracle Cloud Infrastructure Generative AI'],
  ['sap', 'SAP Generative AI Hub (AI Core)', 'enterprise', '#0FAAFF', 'SAP', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.ai.prod.eu-central-1.aws.ml.hana.ondemand.com/v2', 'https://www.sap.com/products/artificial-intelligence.html', ['gpt-4o', 'anthropic--claude-3.5-sonnet'], 'SAP Business AI Core enterprise gateway'],
  ['scaleway', 'Scaleway Generative APIs (EU)', 'enterprise', '#4F0599', 'SCW', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.scaleway.ai/v1', 'https://www.scaleway.com/en/generative-apis/', ['deepseek-r1-distill-llama-70b', 'llama-3.3-70b-instruct'], 'European sovereign cloud inference hosted in Paris'],
  ['ovhcloud', 'OVHcloud AI Endpoints (EU)', 'enterprise', '#2563EB', 'OVH', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1', 'https://endpoints.ai.cloud.ovh.net', ['Meta-Llama-3_3-70B-Instruct', 'DeepSeek-R1-Distill-Llama-70B'], 'OVHcloud European serverless AI endpoints'],
  ['digitalocean', 'DigitalOcean GenAI Platform', 'enterprise', '#0060FF', 'DO', 'api_key', 'paid', 'safe', 'openai-chat', 'https://cluster.do-ai.run/v1', 'https://www.digitalocean.com/products/genai-platform', ['llama-3.3-70b-instruct', 'deepseek-r1-distill-llama-70b'], 'DigitalOcean managed agent & LLM endpoints'],
  ['heroku', 'Heroku Managed Inference', 'enterprise', '#7C3AED', 'HK', 'api_key', 'paid', 'safe', 'openai-chat', 'https://us.inference.heroku.com/v1', 'https://www.heroku.com/ai', ['claude-3-7-sonnet', 'llama-3-3-70b'], 'Salesforce Heroku Managed Inference and Agents'],
  ['modal', 'Modal Serverless GPU', 'enterprise', '#7C3AED', 'MDL', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.modal.com/v1', 'https://modal.com', ['vllm-custom-model'], 'Modal custom serverless GPU container endpoints ($30/mo free credits)'],

  // ============================================================================
  // 8. SPECIALTY MEDIA, IMAGE, VIDEO & EMBEDDINGS (20 Providers)
  // ============================================================================
  ['voyage-ai', 'Voyage AI (Embeddings & Rerank)', 'specialty', '#0F766E', 'VA', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.voyageai.com/v1', 'https://dash.voyageai.com', ['voyage-3-large', 'voyage-code-3', 'rerank-2'], 'Anthropic-recommended code & retrieval embeddings (200M free tokens)'],
  ['jina-ai', 'Jina AI (Embeddings & Reranker)', 'specialty', '#2563EB', 'JA', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.jina.ai/v1', 'https://jina.ai', ['jina-embeddings-v3', 'jina-reranker-v2-base-multilingual', 'jina-clip-v2'], 'Jina AI Search Foundation embeddings, reranker & DeepSearch (10M free tokens)'],
  ['mixedbread', 'Mixedbread AI', 'specialty', '#F59E0B', 'MB', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.mixedbread.ai/v1', 'https://www.mixedbread.ai', ['mxbai-embed-large-v1', 'mxbai-rerank-large-v2'], 'High-precision embeddings & reranking API'],
  ['nomic', 'Nomic Atlas Embeddings', 'specialty', '#7C3AED', 'NM', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api-atlas.nomic.ai/v1', 'https://atlas.nomic.ai', ['nomic-embed-text-v1.5', 'nomic-embed-vision-v1.5'], 'Nomic open-weight multimodal embeddings'],
  ['fal-ai', 'Fal.ai (Fast Media & Flux)', 'specialty', '#2563EB', 'FL', 'api_key', 'paid', 'safe', 'openai-chat', 'https://fal.run', 'https://fal.ai', ['fal-ai/flux-pro/v1.1-ultra', 'fal-ai/kling-video'], 'Ultra-fast Flux image & video generation cloud'],
  ['black-forest-labs', 'Black Forest Labs (FLUX)', 'specialty', '#111827', 'BF', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.bfl.ml/v1', 'https://bfl.ml', ['flux-pro-1.1-ultra', 'flux-pro-1.1', 'flux-dev'], 'Creators of FLUX.1 image generation models'],
  ['stability-ai', 'Stability AI (SD3.5)', 'specialty', '#8B5CF6', 'SA', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.stability.ai/v2beta', 'https://platform.stability.ai', ['sd3.5-large', 'stable-image-ultra'], 'Stable Diffusion 3.5 & Stable Audio API'],
  ['ideogram', 'Ideogram AI', 'specialty', '#EC4899', 'ID', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.ideogram.ai/v1', 'https://ideogram.ai', ['ideogram-v2', 'ideogram-v2-turbo'], 'Typography-accurate image generation API'],
  ['recraft', 'Recraft V3 (Design & SVG)', 'specialty', '#EC4899', 'RC', 'api_key', 'paid', 'safe', 'openai-chat', 'https://external.api.recraft.ai/v1', 'https://www.recraft.ai', ['recraftv3', 'recraftv3-vector'], 'Recraft V3 raster & vector SVG generation (OpenAI-compatible)'],
  ['leonardo', 'Leonardo AI', 'specialty', '#8B5CF6', 'LE', 'api_key', 'paid', 'safe', 'openai-chat', 'https://cloud.leonardo.ai/api/rest/v1', 'https://leonardo.ai', ['phoenix-1.0', 'kino-xl'], 'Creative image & asset generation platform'],
  ['runwayml', 'Runway (Gen-3 Alpha)', 'specialty', '#111827', 'RW', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.dev.runwayml.com/v1', 'https://dev.runwayml.com', ['gen3a_turbo'], 'Runway Gen-3 Alpha video generation API'],
  ['pollinations', 'Pollinations AI (Keyed Pro)', 'specialty', '#4CAF50', 'PO', 'api_key', 'free', 'safe', 'openai-chat', 'https://text.pollinations.ai/openai', 'https://pollinations.ai', ['openai', 'deepseek-r1', 'flux'], 'Pollinations text, audio, and Flux image generation'],
  ['v0-vercel', 'v0 by Vercel API', 'specialty', '#111827', 'V0', 'api_key', 'subscription', 'safe', 'openai-chat', 'https://api.v0.dev/v1', 'https://v0.dev', ['v0-1.0-md'], 'Vercel v0 generative UI & React component model'],
  ['dify', 'Dify Workflow Cloud', 'specialty', '#6366F1', 'DF', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.dify.ai/v1', 'https://dify.ai', ['dify-agent'], 'Dify LLMOps workflow & RAG app backend'],
  ['segmind', 'Segmind Serverless Media', 'specialty', '#7C3AED', 'SG', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.segmind.com/v1', 'https://www.segmind.com', ['sdxl1.0-txt2img', 'flux-pro'], 'Serverless multimodal & workflow APIs'],
  ['nlpcloud', 'NLP Cloud', 'specialty', '#2196F3', 'NLP', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.nlpcloud.io/v1', 'https://nlpcloud.com', ['finetuned-llama-3-70b'], 'Specialized NLP, NER, and translation API'],
  ['clarifai', 'Clarifai', 'specialty', '#7C3AED', 'CLF', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.clarifai.com/v2/ext/openai/v1', 'https://clarifai.com', ['claude-sonnet-4-6', 'Llama-3.3-70B-Instruct'], 'Full-stack computer vision & LLM orchestration'],
  ['deepai', 'DeepAI', 'specialty', '#4A90D9', 'DA', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.deepai.org/v1', 'https://deepai.org', ['text-generator', 'text2img'], 'DeepAI image and text utilities'],
  ['haiper', 'Haiper Video AI', 'specialty', '#6366F1', 'HP', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.haiper.ai/v1', 'https://haiper.ai', ['haiper-video-2.0'], 'Haiper 2.0 video generation'],
  ['udio', 'Udio Music AI', 'specialty', '#10B981', 'UD', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.udio.com/v1', 'https://www.udio.com', ['udio-130'], 'AI music generation endpoint'],

  // ============================================================================
  // 9. AUDIO PROVIDERS — TTS & STT (11 Providers)
  // ============================================================================
  ['elevenlabs', 'ElevenLabs', 'audio', '#111827', '11L', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.elevenlabs.io/v1', 'https://elevenlabs.io', ['eleven_multilingual_v2', 'eleven_flash_v2_5', 'scribe_v1'], 'Industry-leading ultra-realistic TTS & Scribe STT (10k free chars/mo)'],
  ['deepgram', 'Deepgram (Nova-3 & Aura)', 'audio', '#10B981', 'DG', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.deepgram.com/v1', 'https://deepgram.com', ['nova-3', 'nova-2', 'aura-asteria-en'], 'Real-time Nova-3 STT & Aura TTS ($200 free signup credit)'],
  ['assemblyai', 'AssemblyAI (Universal-2)', 'audio', '#2563EB', 'AAI', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.assemblyai.com/v2', 'https://www.assemblyai.com', ['universal-2', 'nano'], 'High-accuracy speech recognition & speaker diarization'],
  ['cartesia', 'Cartesia (Sonic TTS)', 'audio', '#FF4F8B', 'CA', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.cartesia.ai', 'https://cartesia.ai', ['sonic-2', 'sonic-english'], 'Ultra-low-latency 40ms SSM voice synthesis'],
  ['fishaudio', 'Fish Audio (Fish Speech)', 'audio', '#3B82F6', 'FA', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.fish.audio/v1', 'https://fish.audio', ['speech-1.6', 'speech-1.5'], 'Expressive zero-shot voice cloning & TTS'],
  ['playht', 'PlayHT', 'audio', '#00B4D8', 'PH', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.play.ht/api/v2', 'https://play.ht', ['PlayDialog', 'Play3.0-mini'], 'Conversational multi-turn voice dialog synthesis'],
  ['gladia', 'Gladia Audio Intelligence', 'audio', '#6425FE', 'GL', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.gladia.io/v2', 'https://www.gladia.io', ['solaria-1', 'whisper-zero'], 'Multilingual real-time STT (10 free hours/month)'],
  ['speechmatics', 'Speechmatics', 'audio', '#0A2540', 'SM', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://asr.api.speechmatics.com/v2', 'https://www.speechmatics.com', ['ursa-2'], 'Enterprise speech recognition across 50+ languages'],
  ['rev-ai', 'Rev AI', 'audio', '#FF5C35', 'RV', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.rev.ai/speechtotext/v1', 'https://www.rev.ai', ['reverb-v1'], 'Speech-to-text & human-level transcription API'],
  ['inworld', 'Inworld Voice & Character AI', 'audio', '#7B2EF2', 'IW', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.inworld.ai/v1', 'https://inworld.ai', ['inworld-tts-1'], 'Real-time NPC & conversational character voice engine'],
  ['aws-polly', 'Amazon Polly', 'audio', '#FF9900', 'PL', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://polly.us-east-1.amazonaws.com', 'https://aws.amazon.com/polly/', ['generative', 'neural'], 'AWS Neural & Generative Text-to-Speech'],

  // ============================================================================
  // 10. SEARCH & WEB GROUNDING (13 Providers)
  // ============================================================================
  ['tavily-search', 'Tavily AI Search', 'search', '#5B4FDB', 'TV', 'api_key', 'free', 'safe', 'openai-chat', 'https://api.tavily.com', 'https://tavily.com', ['tavily-search-advanced', 'tavily-extract'], 'Purpose-built search engine for AI agents (1,000 free searches/mo)'],
  ['exa-search', 'Exa.ai Neural Search', 'search', '#1E40AF', 'EX', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.exa.ai', 'https://exa.ai', ['exa-pro', 'exa-answer'], 'Embeddings-based neural web search & OpenAI-compatible `/chat/completions`'],
  ['brave-search', 'Brave Search API', 'search', '#FB542B', 'BR', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.search.brave.com/res/v1', 'https://brave.com/search/api/', ['brave-web-search', 'brave-summarizer'], 'Independent web index with AI grounding'],
  ['serper-search', 'Serper.dev (Google Search)', 'search', '#4285F4', 'SP', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://google.serper.dev', 'https://serper.dev', ['serper-search', 'serper-scholar'], 'Fast low-cost Google SERP JSON API (2,500 free queries)'],
  ['firecrawl', 'Firecrawl (Web-to-Markdown)', 'search', '#FB923C', 'FC', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.firecrawl.dev/v1', 'https://www.firecrawl.dev', ['firecrawl-scrape', 'firecrawl-extract'], 'Turn entire websites into LLM-ready clean markdown'],
  ['jina-reader', 'Jina Reader (r.jina.ai)', 'search', '#0EA5E9', 'JR', 'api_key', 'free', 'safe', 'openai-chat', 'https://r.jina.ai', 'https://jina.ai/reader/', ['jina-reader-lm-v2'], 'Zero-config URL-to-Markdown reader & `s.jina.ai` web search'],
  ['perplexity-search', 'Perplexity Search Grounding', 'search', '#20808D', 'PS', 'api_key', 'paid', 'safe', 'openai-chat', 'https://api.perplexity.ai', 'https://www.perplexity.ai', ['sonar-pro'], 'Real-time citation-backed search via Perplexity Sonar'],
  ['youcom-search', 'You.com Smart/Research API', 'search', '#2563EB', 'YOU', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://chat-api.you.com', 'https://api.you.com', ['you-research', 'you-smart'], 'You.com RAG & live web search API'],
  ['linkup-search', 'Linkup Search', 'search', '#0F766E', 'LU', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.linkup.so/v1', 'https://www.linkup.so', ['linkup-deep', 'linkup-standard'], 'Agentic web search & premium content grounding'],
  ['parallel-search', 'Parallel Web Systems', 'search', '#0F172A', 'PA', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://api.parallel.ai/v1', 'https://parallel.ai', ['parallel-search'], 'High-concurrency deep web research API'],
  ['context7', 'Context7 (Live Library Docs)', 'search', '#6B4FBB', 'C7', 'no_auth', 'free', 'safe', 'openai-chat', 'https://context7.com/api/v1', 'https://context7.com', ['context7-docs'], 'Up-to-date version-accurate code documentation for LLMs'],
  ['searxng-search', 'SearXNG Self-Hosted Instance', 'search', '#1A237E', 'SX', 'no_auth', 'free', 'safe', 'openai-chat', 'https://searx.be', 'https://docs.searxng.org', ['searxng-json'], 'Privacy-respecting metasearch engine JSON endpoint'],
  ['google-pse-search', 'Google Programmable Search', 'search', '#4285F4', 'GP', 'api_key', 'freemium', 'safe', 'openai-chat', 'https://www.googleapis.com/customsearch/v1', 'https://programmablesearchengine.google.com', ['google-cse'], 'Official Google Custom Search JSON API (100 free queries/day)'],

  // ============================================================================
  // 11. NO-AUTH FREE PROVIDERS (7 Providers)
  // ============================================================================
  ['pollinations-free', 'Pollinations Free (Zero Key)', 'noauth', '#4CAF50', 'PF', 'no_auth', 'free', 'safe', 'openai-chat', 'https://text.pollinations.ai/openai', 'https://pollinations.ai', ['openai', 'deepseek-r1', 'qwen-coder', 'mistral'], '100% Free zero-API-key OpenAI-compatible endpoint hosted by Pollinations.ai'],
  ['duckduckgo-web', 'DuckDuckGo AI Chat', 'noauth', '#DE5833', 'DDG', 'no_auth', 'free', 'caution', 'openai-chat', 'https://duckduckgo.com/duckchat/v1', 'https://duckduckgo.com/duckchat', ['gpt-4o-mini', 'claude-3-haiku-20240307', 'llama-3.3-70b'], 'Anonymous Duck.ai chat endpoint'],
  ['uncloseai', 'UncloseAI (Free Public LLM)', 'noauth', '#8B5CF6', 'UN', 'no_auth', 'free', 'safe', 'openai-chat', 'https://hermes.ai.unturf.com/v1', 'https://uncloseai.com', ['adamo1139/Hermes-3-Llama-3.1-8B-FP8-Dynamic'], 'Public zero-key OpenAI-compatible Hermes 3 endpoint'],
  ['aihorde', 'AI Horde (KobaldAI Community)', 'noauth', '#8B5CF6', 'AH', 'no_auth', 'free', 'safe', 'openai-chat', 'https://oai.aihorde.net/v1', 'https://aihorde.net', ['aphrodite/Qwen2.5-72B-Instruct'], 'Crowdsourced volunteer GPU cluster (`0000000000` anonymous key)'],
  ['cloudflare-playground', 'Cloudflare AI (via Native Binding)', 'noauth', '#F38020', 'CFP', 'workers_ai', 'free', 'safe', 'workers-ai', 'binding://env.AI', 'https://playground.ai.cloudflare.com', ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/qwen/qwen2.5-coder-32b-instruct'], 'Direct native Cloudflare edge execution (replaces OmniRoute Playwright scraper)'],
  ['veoaifree-web', 'Veo AI Free', 'noauth', '#8B5CF6', 'VF', 'no_auth', 'free', 'caution', 'openai-chat', 'https://veoaifree.com/api/v1', 'https://veoaifree.com', ['gpt-4o-mini'], 'Zero-auth community web endpoint'],
  ['llm7-free', 'LLM7 Anonymous Free', 'noauth', '#6366F1', 'L7', 'no_auth', 'free', 'safe', 'openai-chat', 'https://api.llm7.io/v1', 'https://llm7.io', ['gpt-4o-mini', 'mistral-small'], 'No-key required public research endpoint (`unused` token)'],

  // ============================================================================
  // 12. WEB / COOKIE SESSION PROVIDERS (15 Providers)
  // ============================================================================
  ['chatgpt-web', 'ChatGPT Web Session', 'web_cookie', '#10A37F', 'CG', 'web_cookie', 'subscription', 'tos_avoid', 'openai-chat', 'https://chatgpt.com/backend-api', 'https://chatgpt.com', ['gpt-4o', 'o3-mini'], 'Consumer ChatGPT web session cookie forwarder (`tos: avoid`)'],
  ['claude-web', 'Claude.ai Web Session', 'web_cookie', '#D97757', 'CW', 'web_cookie', 'subscription', 'tos_avoid', 'anthropic-messages', 'https://claude.ai/api', 'https://claude.ai', ['claude-sonnet-4-6', 'claude-opus-4-6'], 'Consumer Claude.ai web session cookie bridge (`tos: avoid`)'],
  ['grok-web', 'Grok.com Web Session', 'web_cookie', '#1DA1F2', 'GW', 'web_cookie', 'subscription', 'tos_avoid', 'openai-chat', 'https://grok.com/rest/app-chat', 'https://grok.com', ['grok-3'], 'Consumer Grok.com web session cookie bridge (`tos: avoid`)'],
  ['gemini-web', 'Gemini Web (gemini.google.com)', 'web_cookie', '#4285F4', 'GWb', 'web_cookie', 'free', 'tos_avoid', 'gemini', 'https://gemini.google.com', 'https://gemini.google.com', ['gemini-2.5-pro', 'gemini-2.5-flash'], 'Consumer Gemini Web `__Secure-1PSID` cookie bridge (`tos: avoid`)'],
  ['deepseek-web', 'DeepSeek Chat Web', 'web_cookie', '#4D6BFE', 'DSW', 'web_cookie', 'free', 'tos_avoid', 'openai-chat', 'https://chat.deepseek.com/api/v0', 'https://chat.deepseek.com', ['deepseek-r1', 'deepseek-v3'], 'chat.deepseek.com bearer userToken bridge (`tos: avoid`)'],
  ['perplexity-web', 'Perplexity Web (Pro/Max)', 'web_cookie', '#20808D', 'PW', 'web_cookie', 'subscription', 'tos_avoid', 'openai-chat', 'https://www.perplexity.ai/api', 'https://www.perplexity.ai', ['sonar-pro', 'claude-3.7-sonnet'], 'Perplexity web session cookie adapter (`tos: avoid`)'],
  ['copilot-web', 'Microsoft Copilot Web', 'web_cookie', '#0078D4', 'CPW', 'web_cookie', 'free', 'caution', 'openai-chat', 'https://copilot.microsoft.com', 'https://copilot.microsoft.com', ['gpt-4o'], 'Microsoft Consumer Copilot web session'],
  ['copilot-m365-web', 'Microsoft 365 Copilot (BizChat)', 'web_cookie', '#0078D4', 'M365', 'web_cookie', 'subscription', 'caution', 'openai-chat', 'https://m365.cloud.microsoft/chat', 'https://m365.cloud.microsoft/chat', ['gpt-4o'], 'M365 Enterprise BizChat session adapter'],
  ['t3-web', 't3.chat Web (Pro/Free)', 'web_cookie', '#7C3AED', 'T3', 'web_cookie', 'subscription', 'tos_avoid', 'openai-chat', 'https://t3.chat/api', 'https://t3.chat', ['claude-sonnet-4-6', 'gemini-2.5-flash'], 't3.chat web session cookie adapter'],
  ['blackbox-web', 'Blackbox Web', 'web_cookie', '#1A1A2E', 'BW', 'web_cookie', 'free', 'caution', 'openai-chat', 'https://www.blackbox.ai/api/chat', 'https://www.blackbox.ai', ['blackboxai'], 'Blackbox web chat session endpoint'],
  ['huggingchat', 'HuggingChat Web (Free)', 'web_cookie', '#FFD21E', 'HC', 'web_cookie', 'free', 'safe', 'openai-chat', 'https://huggingface.co/chat', 'https://huggingface.co/chat', ['Qwen/Qwen2.5-72B-Instruct', 'meta-llama/Llama-3.3-70B-Instruct'], 'HuggingChat free web session'],
  ['lmarena', 'LMSYS Chatbot Arena Web', 'web_cookie', '#FF6B6B', 'AR', 'web_cookie', 'free', 'tos_avoid', 'openai-chat', 'https://lmarena.ai', 'https://lmarena.ai', ['arena-model'], 'LMSYS Arena web session (`tos: avoid`)'],
  ['yuanbao-web', 'Tencent Yuanbao Web (Free)', 'web_cookie', '#0052D9', 'YB', 'web_cookie', 'free', 'caution', 'openai-chat', 'https://yuanbao.tencent.com/api', 'https://yuanbao.tencent.com', ['deepseek-r1', 'hunyuan-t1'], 'Tencent Yuanbao free DeepSeek-R1 web session'],
  ['poe-web', 'Poe Web Session', 'web_cookie', '#6C3AED', 'PWb', 'web_cookie', 'subscription', 'caution', 'openai-chat', 'https://poe.com/api', 'https://poe.com', ['Claude-3.7-Sonnet', 'GPT-4o'], 'Poe `p-b` cookie session adapter'],
  ['muse-spark-web', 'Meta AI Web (meta.ai)', 'web_cookie', '#0866FF', 'MS', 'web_cookie', 'free', 'caution', 'openai-chat', 'https://www.meta.ai/api', 'https://www.meta.ai', ['llama-4-maverick'], 'Meta AI web session adapter'],

  // ============================================================================
  // 13. SELF-HOSTED / CLOUDFLARE TUNNEL RUNTIMES (10 Providers)
  // ============================================================================
  ['ollama-local', 'Ollama (via Cloudflare Tunnel / HTTPS)', 'remote_local', '#58A6FF', 'OL', 'api_key', 'free', 'safe', 'openai-chat', 'https://ollama-tunnel.example.com/v1', 'https://ollama.com', ['qwen2.5-coder:32b', 'deepseek-r1:32b', 'llama3.3:70b'], 'Connect your self-hosted Ollama server to FlareRoute via Cloudflare Tunnel (`cloudflared`)'],
  ['vllm', 'vLLM Server (via HTTPS / Tunnel)', 'remote_local', '#0F766E', 'VL', 'api_key', 'free', 'safe', 'openai-chat', 'https://vllm-tunnel.example.com/v1', 'https://docs.vllm.ai', ['Qwen/Qwen2.5-Coder-32B-Instruct'], 'Connect a self-hosted vLLM GPU cluster via HTTPS or Cloudflare Tunnel'],
  ['lm-studio', 'LM Studio Server (via Tunnel)', 'remote_local', '#4A148C', 'LM', 'api_key', 'free', 'safe', 'openai-chat', 'https://lmstudio-tunnel.example.com/v1', 'https://lmstudio.ai', ['mlx-community/Qwen2.5-Coder-32B-Instruct-4bit'], 'Connect Apple Silicon / Desktop LM Studio server via Cloudflare Tunnel'],
  ['llama-cpp', 'llama.cpp HTTP Server (via Tunnel)', 'remote_local', '#795548', 'LC', 'api_key', 'free', 'safe', 'openai-chat', 'https://llamacpp-tunnel.example.com/v1', 'https://github.com/ggml-org/llama.cpp', ['local-gguf-model'], 'Connect `llama-server` GGUF endpoint via HTTPS tunnel'],
  ['mlx-qwen', 'Apple MLX Server (Qwen / Gemma)', 'remote_local', '#EC4899', 'MLX', 'api_key', 'free', 'safe', 'openai-chat', 'https://mlx-tunnel.example.com/v1', 'https://github.com/ml-explore/mlx-lm', ['mlx-community/Qwen2.5-Coder-32B-4bit'], 'Connect Mac Studio / Apple Silicon `mlx_lm.server` via Cloudflare Tunnel'],
  ['xinference', 'Xorbits Xinference (via Tunnel)', 'remote_local', '#DC2626', 'XI', 'api_key', 'free', 'safe', 'openai-chat', 'https://xinference-tunnel.example.com/v1', 'https://inference.readthedocs.io', ['qwen2.5-instruct'], 'Self-hosted Xinference cluster endpoint'],
  ['docker-model-runner', 'Docker Model Runner (via Tunnel)', 'remote_local', '#2496ED', 'DM', 'api_key', 'free', 'safe', 'openai-chat', 'https://docker-ai-tunnel.example.com/engines/llama.cpp/v1', 'https://docs.docker.com/desktop/features/model-runner/', ['ai/llama3.2'], 'Docker Desktop Model Runner exposed via tunnel'],
  ['lemonade', 'Lemonade Server (ONNX / Ryzen AI)', 'remote_local', '#F59E0B', 'LMN', 'api_key', 'free', 'safe', 'openai-chat', 'https://lemonade-tunnel.example.com/api/v0', 'https://lemonade-server.ai', ['Llama-3.2-3B-Instruct-Hybrid'], 'AMD Ryzen AI / ONNX Lemonade server via tunnel'],
  ['triton', 'NVIDIA Triton Inference Server', 'remote_local', '#76B900', 'TR', 'api_key', 'free', 'safe', 'openai-chat', 'https://triton-tunnel.example.com/v1', 'https://developer.nvidia.com/triton-inference-server', ['tensorrt-llm-model'], 'Self-hosted NVIDIA Triton TensorRT-LLM OpenAI frontend'],
  ['litellm-proxy', 'LiteLLM / Custom OpenAI Proxy', 'remote_local', '#6366F1', 'LL', 'api_key', 'free', 'safe', 'openai-chat', 'https://litellm.example.com/v1', 'https://docs.litellm.ai', ['custom-model'], 'Any custom OpenAI-compatible reverse proxy or LiteLLM instance'],

  // ============================================================================
  // 14. BANSOS & COMMUNITY 100% FREE PROVIDERS (bansos.dev & freellmapi)
  // ============================================================================
  ['hetzner', 'Hetzner Inference (Experimental Free)', 'inference', '#D50C2D', 'HZ', 'api_key', 'free', 'safe', 'openai-chat', 'https://inference.hetzner.com/v1', 'https://experiments.hetzner.com/inference', ['qwen3.6-35b-a3b'], 'Hetzner experimental 100% free inference API (10 RPM, 4M input TPM)'],
  ['aionlabs', 'Aion Labs Free API', 'frontier', '#3B82F6', 'AL', 'api_key', 'free', 'safe', 'openai-chat', 'https://api.aionlabs.ai/v1', 'https://www.aionlabs.ai/app/api-keys/', ['aion-labs/aion-3.0', 'aion-labs/aion-2.0'], 'Aion Labs free developer API (15 RPM, 20K TPD, No Credit Card)'],
  ['bazaarlink', 'BazaarLink Free Router', 'gateways', '#10B981', 'BL', 'api_key', 'free', 'safe', 'openai-chat', 'https://api.bazaarlink.ai/v1', 'https://bazaarlink.ai', ['auto:free'], 'BazaarLink free aggregator (10 RPM, 130 RPD on `auto:free`)'],
  ['freeai', 'Free.ai Developer API', 'gateways', '#059669', 'FA', 'api_key', 'free', 'safe', 'openai-chat', 'https://api.free.ai/v1', 'https://free.ai/developer/', ['free-ai-default'], 'Free.ai developer endpoint (60 RPM, 30K TPD, 1,000 req/month)'],
  ['agnes', 'Agnes AI Platform', 'gateways', '#8B5CF6', 'AG', 'api_key', 'free', 'safe', 'openai-chat', 'https://apihub.agnes-ai.com/v1', 'https://platform.agnes-ai.com/settings/apiKeys', ['agnes-1.5-flash'], 'Agnes AI free 30 RPM endpoint'],
  ['bynara', 'byNara (Router AI Lokal Indonesia)', 'regional', '#10B981', 'BN', 'api_key', 'free', 'safe', 'openai-chat', 'https://api.bynara.id/v1', 'https://bansos.dev/list/', ['bynara-free-auto', 'deepseek-r1', 'llama-3.3-70b'], 'Router AI lokal karya anak bangsa dengan Free Tier tanpa kartu kredit (rujukan bansos.dev)'],
  ['artbloom', 'Artbloom ($100 Bansos Credit)', 'gateways', '#EC4899', 'AB', 'api_key', 'free', 'safe', 'openai-chat', 'https://api.artbloom.ai/v1', 'https://bansos.dev/list/', ['claude-sonnet-4-6', 'gpt-4o', 'deepseek-r1'], 'Bansos $100 Free AI API Credit tanpa kartu kredit + Daily Check-in (rujukan bansos.dev)'],
  ['kie-ai', 'Kie.ai (Bansos Free Credit)', 'gateways', '#0EA5E9', 'KI', 'api_key', 'free', 'safe', 'openai-chat', 'https://api.kie.ai/v1', 'https://bansos.dev/list/', ['deepseek-r1', 'gpt-4o-mini'], 'Penyedia API AI murah & cepat dengan saldo gratis awal (rujukan bansos.dev)'],
];

/**
 * BansosRouter 100% Free-Tier Lock:
 * Only expose providers that offer a Free Tier, Free OAuth, Zero-Key, or Bansos Credits (excludes paid-only APIs).
 */
export const PROVIDER_REGISTRY: ProviderRegistryItem[] = RAW_PROVIDERS.filter(
  ([, , , , , , tier]) => tier !== 'paid'
).map(
  ([
    id,
    name,
    category,
    color,
    textIcon,
    authType,
    tier,
    tosRisk,
    protocol,
    baseUrl,
    website,
    defaultModels,
    description,
  ]) => ({
    id,
    name,
    category,
    color,
    textIcon,
    authType,
    tier: tier === 'subscription' ? 'freemium' : tier,
    tosRisk,
    protocol,
    baseUrl,
    website,
    defaultModels,
    description,
  })
);

const PROVIDER_MAP = new Map<string, ProviderRegistryItem>(
  PROVIDER_REGISTRY.map((p) => [p.id, p])
);

export function findProviderRegistryItem(providerId: string): ProviderRegistryItem | undefined {
  const direct = PROVIDER_MAP.get(providerId);
  if (direct) return direct;
  if (providerId === 'claude') return PROVIDER_MAP.get('claude-code');
  if (providerId === 'github') return PROVIDER_MAP.get('github-models') ?? PROVIDER_MAP.get('github-copilot');
  if (providerId === 'cloudflare-ai') return PROVIDER_MAP.get('workers-ai');
  if (providerId === 'zhipu') return PROVIDER_MAP.get('bigmodel');
  if (providerId === 'opencode') return PROVIDER_MAP.get('opencode-zen');
  return undefined;
}

