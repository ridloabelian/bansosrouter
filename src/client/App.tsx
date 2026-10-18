import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Cpu,
  KeyRound,
  Layers,
  Lock,
  Play,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Terminal,
  Gift,
  CreditCard,
  BookOpen,
} from 'lucide-react';

interface ConnectionItem {
  id: string;
  name: string;
  provider: string;
  authType: string;
  accountLabel: string;
  priority: number;
  weight: number;
  tier: string;
  tosRisk: 'safe' | 'caution' | 'tos_avoid';
  dailyTokenLimit: number;
  tokensUsedToday: number;
  windowTokenLimit: number;
  tokensUsedWindow: number;
  windowResetAt: number | null;
  tokenExpiresAt: number | null;
  status: string;
  consecutiveFailures: number;
  avgLatencyMs: number;
  totalRequests: number;
  totalTokens: number;
  totalCostUsd: number;
  sdkPersona?: string;
  sdkPersonaSlot?: number;
}

interface ComboItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  strategy: string;
  compressionProfile: string;
  cacheTtlSeconds: number;
  isSystem: boolean;
  isActive: boolean;
}

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  spentTodayUsd: number;
  spentMonthUsd: number;
  quotaSharePercent: number;
  rateLimitRpm: number;
  defaultStrategy: string;
  compressionProfile: string;
  totalRequests: number;
  totalTokensSaved: number;
}

interface UsageLogItem {
  id: string;
  requestId: string;
  provider: string;
  modelRequested: string;
  modelUsed: string;
  strategyUsed: string;
  inboundProtocol: string;
  promptTokens: number;
  completionTokens: number;
  tokensSaved: number;
  costUsd: number;
  latencyMs: number;
  statusCode: number;
  createdAt: number;
}

type CreditCardPolicy = 'no_cc' | 'phone_only' | 'oauth_free' | 'free_credits' | 'zero_key';
type BansosCategory =
  | 'official-free-api'
  | 'free-credits-bansos'
  | 'oauth-cli-free'
  | 'zero-key-community'
  | 'indo-local';

interface FreeTierItem {
  id: string;
  name: string;
  provider: string;
  authType: string;
  dailyFreeTokens: number;
  monthlyFreeTokens: number;
  rpmLimit: number;
  rpdLimit: number;
  creditCardPolicy: CreditCardPolicy;
  creditCardLabel: string;
  bansosCategory: BansosCategory;
  tosRisk: 'safe' | 'caution' | 'tos_avoid';
  tosNote: string;
  signupUrl: string;
  featuredModels: string[];
  claimSteps: string[];
  verificationBadge: string;
  sourceRefs: string[];
  description: string;
}

interface BansosWatchlistItem {
  providerName: string;
  status: 'no_longer_free' | 'credit_card_trap' | 'trial_expired';
  reason: string;
  freeAlternativeInBansosRouter: string;
  sourceRef: string;
}

interface OAuthProviderItem {
  id: string;
  name: string;
  flowType: 'device_code' | 'pkce_paste';
  redirectUri: string;
  tosRisk: 'safe' | 'caution' | 'tos_avoid';
  defaultModels: string[];
  description: string;
}

interface ProviderRegistryClientItem {
  id: string;
  name: string;
  category: string;
  color: string;
  textIcon: string;
  authType: string;
  tier: 'free' | 'subscription' | 'paid' | 'freemium';
  tosRisk: 'safe' | 'caution' | 'tos_avoid';
  protocol: string;
  baseUrl: string;
  website: string;
  defaultModels: string[];
  description: string;
}

interface ProviderCategoryClientMeta {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
}

interface OverviewResponse {
  zeroCostGuarantee?: boolean;
  stats: {
    totalRequests: number;
    totalTokens: number;
    totalTokensSaved: number;
    totalCachedTokens: number;
    totalCostUsd: number;
    avgLatencyMs: number;
  };
  connections: ConnectionItem[];
  combos: ComboItem[];
  apiKeys: ApiKeyItem[];
  recentLogs: UsageLogItem[];
  resilience: {
    circuits: Array<{ provider: string; state: string; failures: number; lastError: string | null }>;
    cooldowns: Array<{ connectionId: string; untilMs: number; reason: string }>;
    modelLockouts: Array<{ connectionId: string; model: string; untilMs: number; reason: string }>;
  };
  catalogs: {
    strategies: string[];
    virtualAutoCombos: string[];
    compressionLayers: string[];
    compressionProfiles: string[];
    freeTiers: FreeTierItem[];
    bansosWatchlist?: BansosWatchlistItem[];
    totalMonthlyBansosTokens?: number;
    oauthProviders: OAuthProviderItem[];
    providerRegistry?: ProviderRegistryClientItem[];
    providerCategories?: ProviderCategoryClientMeta[];
  };
}

type NavTab =
  | 'free-tiers'
  | 'overview'
  | 'connections'
  | 'combos'
  | 'compression'
  | 'keys'
  | 'playground';

export function App(): React.ReactElement {
  const [adminToken, setAdminToken] = useState<string>(
    () => localStorage.getItem('bansosrouter_admin_token') ?? ''
  );
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [loginUsername, setLoginUsername] = useState<string>('admin');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<NavTab>('free-tiers');
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [toast, setToast] = useState<string | null>(null);

  // OAuth Modal Dialog ref (uses native <dialog closedby="any"> + showModal())
  const oauthDialogRef = useRef<HTMLDialogElement | null>(null);
  const [selectedOAuthProvider, setSelectedOAuthProvider] = useState<string>('gemini-cli');
  const [oauthAccountName, setOAuthAccountName] = useState<string>('');
  const [pkceAuthUrl, setPkceAuthUrl] = useState<string>('');
  const [pkceState, setPkceState] = useState<string>('');
  const [pastedCallbackInput, setPastedCallbackInput] = useState<string>('');
  const [deviceSession, setDeviceSession] = useState<{
    sessionId: string;
    userCode: string;
    verificationUri: string;
  } | null>(null);

  // Provider Catalog Search & Category Filter state
  const [providerSearch, setProviderSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Bansos Catalog Filter state
  const [bansosPolicyFilter, setBansosPolicyFilter] = useState<string>('all');
  const [bansosSearch, setBansosSearch] = useState<string>('');
  const [selectedAgentSnippet, setSelectedAgentSnippet] = useState<
    'claude-code' | 'codex' | 'cursor' | 'cline' | 'aider'
  >('claude-code');

  // New API Key / Token / Tunnel Connection state
  const [connName, setConnName] = useState<string>('');
  const [connProvider, setConnProvider] = useState<string>('groq');
  const [connApiKey, setConnApiKey] = useState<string>('');
  const [connBaseUrl, setConnBaseUrl] = useState<string>('');
  const [connTier, setConnTier] = useState<string>('free');
  const [connPriority, setConnPriority] = useState<number>(10);
  const connectFormRef = useRef<HTMLFormElement | null>(null);

  // Free-Tier Bansos Calculator selected IDs (default: all active)
  const [selectedFreeTiers, setSelectedFreeTiers] = useState<Record<string, boolean>>({});

  // Client API Key Generator state
  const [newKeyName, setNewKeyName] = useState<string>('Claude Code / Cursor Bansos Key');
  const [newKeyQuotaShare, setNewKeyQuotaShare] = useState<number>(100);
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);

  // 10-Layer Compression Simulator state
  const [simProfile, setSimProfile] = useState<string>('balanced');
  const [simInput, setSimInput] = useState<string>(
    `Could you please kindly analyze this uniform JSON telemetry array and test runner log so we save our daily free Bansos tokens? Thank you so much in advance!\n\n` +
      JSON.stringify([
        { id: 1, edge: 'CGK-01', provider: 'groq', model: 'llama-3.3-70b-versatile', cost_idr: 0, latency_ms: 48 },
        { id: 2, edge: 'SIN-02', provider: 'cerebras', model: 'qwen-3-235b-a22b', cost_idr: 0, latency_ms: 39 },
        { id: 3, edge: 'CGK-02', provider: 'gemini', model: 'gemini-2.5-pro', cost_idr: 0, latency_ms: 190 },
        { id: 4, edge: 'SIN-01', provider: 'chutes', model: 'deepseek-r1', cost_idr: 0, latency_ms: 155 },
      ]) +
      `\n\nPASS src/sse/translators.spec.ts\n✓ translates OpenAI Chat\n✓ translates OpenAI Responses\n✓ translates Anthropic Messages\n✓ translates Gemini v1beta\n✓ locks cost at Rp 0 ($0.00)`
  );
  const [simResult, setSimResult] = useState<{
    originalText: string;
    compressedText: string;
    stats: {
      originalTokens: number;
      compressedTokens: number;
      tokensSaved: number;
      savingsPercent: number;
      layersApplied: string[];
      ccrArchivedIds: string[];
    };
  } | null>(null);

  // Live Playground state
  const [pgProtocol, setPgProtocol] = useState<
    'openai-chat' | 'openai-responses' | 'anthropic-messages' | 'gemini'
  >('openai-chat');
  const [pgModel, setPgModel] = useState<string>('bansos/auto');
  const [pgStrategy, setPgStrategy] = useState<string>('reset-aware');
  const [pgPrompt, setPgPrompt] = useState<string>(
    'Jelaskan bagaimana BansosRouter menggabungkan 24+ provider LLM gratisan (Groq, Cerebras, Gemini AI Studio, OpenRouter :free, Chutes, Pollinations, Qwen OAuth) menjadi 1 endpoint $0 (Rp 0) anti-limit!'
  );
  const [pgOutput, setPgOutput] = useState<string>('');
  const [pgHeaders, setPgHeaders] = useState<Record<string, string>>({});
  const [pgRunning, setPgRunning] = useState<boolean>(false);

  const showNotice = (msg: string): void => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4200);
  };

  const fetchOverview = async (tokenOverride?: string): Promise<void> => {
    const tokenToUse = tokenOverride ?? adminToken;
    if (!tokenToUse) {
      setIsAuthenticated(false);
      setAuthChecking(false);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch('/api/admin/overview', {
        headers: { 'x-admin-token': tokenToUse },
      });
      if (res.ok) {
        const json = (await res.json()) as OverviewResponse;
        setData(json);
        setIsAuthenticated(true);
        // Initialize all freeTiers checked if not yet set
        if (json.catalogs.freeTiers?.length) {
          setSelectedFreeTiers((prev) => {
            if (Object.keys(prev).length > 0) return prev;
            const initial: Record<string, boolean> = {};
            for (const ft of json.catalogs.freeTiers) {
              initial[ft.id] = true;
            }
            return initial;
          });
        }
      } else if (res.status === 401) {
        localStorage.removeItem('bansosrouter_admin_token');
        setAdminToken('');
        setIsAuthenticated(false);
      }
    } catch {
      // ignore offline error
    } finally {
      setLoading(false);
      setAuthChecking(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword,
        }),
      });
      if (!res.ok) {
        setLoginError('Username atau password salah. Akses ditolak.');
        return;
      }
      const json = (await res.json()) as { ok: boolean; token: string };
      localStorage.setItem('bansosrouter_admin_token', json.token);
      setAdminToken(json.token);
      setLoginPassword('');
      await fetchOverview(json.token);
      showNotice('Berhasil masuk ke Gudang BansosRouter ($0 Lock Active)!');
    } catch {
      setLoginError('Gagal menghubungi server autentikasi.');
    }
  };

  const handleAdminLogout = (): void => {
    localStorage.removeItem('bansosrouter_admin_token');
    setAdminToken('');
    setIsAuthenticated(false);
    setData(null);
  };

  useEffect(() => {
    void fetchOverview();
  }, [adminToken]);

  // Progressive fallback for browsers without native `<dialog closedby="any">` support
  useEffect(() => {
    const dialog = oauthDialogRef.current;
    if (!dialog) return;
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const handleBackdropClick = (event: MouseEvent): void => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (isDialogContent) return;
        dialog.close();
      };
      dialog.addEventListener('click', handleBackdropClick);
      return () => dialog.removeEventListener('click', handleBackdropClick);
    }
  }, [isAuthenticated]);

  const openOAuthWizard = (providerId?: string): void => {
    if (providerId) setSelectedOAuthProvider(providerId);
    setPkceAuthUrl('');
    setDeviceSession(null);
    setPastedCallbackInput('');
    oauthDialogRef.current?.showModal();
  };

  const handleSeedDemoConnections = async (): Promise<void> => {
    const res = await fetch('/api/admin/connections/seed-demo', {
      method: 'POST',
      headers: { 'x-admin-token': adminToken },
    });
    if (res.ok) {
      showNotice('7 Koneksi Bansos Starter (100% Gratis • Rp 0) berhasil dipasang ke pool!');
      await fetchOverview();
    }
  };

  const handleAddApiKeyConnection = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const regItem = (data?.catalogs.providerRegistry ?? []).find((p) => p.id === connProvider);
    const res = await fetch('/api/admin/connections', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({
        name: connName || `${regItem?.name ?? connProvider.toUpperCase()} Bansos`,
        provider: connProvider,
        authType: regItem?.authType ?? 'api_key',
        apiKey: connApiKey || 'bansos-free-tier-token',
        baseUrl: connBaseUrl.trim() || undefined,
        tier: 'free',
        tosRisk: regItem?.tosRisk ?? 'safe',
        priority: connPriority,
        supportedModels: regItem?.defaultModels,
      }),
    });
    if (res.ok) {
      setConnName('');
      setConnApiKey('');
      showNotice(`Koneksi ${regItem?.name ?? connProvider} dienkripsi AES-256-GCM & disimpan ke D1 ($0 Lock)!`);
      await fetchOverview();
    }
  };

  const handleQuickConnectBansosItem = (ft: FreeTierItem): void => {
    if (ft.authType === 'oauth_device' || ft.authType === 'oauth_pkce') {
      openOAuthWizard(ft.provider);
      return;
    }
    setActiveTab('connections');
    setConnProvider(ft.provider);
    setConnName(`${ft.name} #1`);
    setConnTier('free');
    const regItem = (data?.catalogs.providerRegistry ?? []).find((p) => p.id === ft.provider);
    if (regItem) {
      setConnBaseUrl(regItem.baseUrl.startsWith('binding://') ? '' : regItem.baseUrl);
    }
    window.setTimeout(() => {
      connectFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
    showNotice(`Dipilih: ${ft.name} — masukkan API key gratis Anda (atau langsung klik Simpan untuk Zero-Key)!`);
  };

  const handleQuickSelectProvider = (p: ProviderRegistryClientItem): void => {
    if (p.category === 'oauth') {
      openOAuthWizard(p.id);
      return;
    }
    setConnProvider(p.id);
    setConnName(`${p.name} #1`);
    setConnTier('free');
    setConnBaseUrl(p.baseUrl.startsWith('binding://') ? '' : p.baseUrl);
    connectFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showNotice(`Dipilih: ${p.name} (${p.authType}) — siap dipasang ke pool BansosRouter!`);
  };

  const handleStartPkce = async (): Promise<void> => {
    const res = await fetch('/api/oauth/pkce/start', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({
        providerId: selectedOAuthProvider,
        accountName: oauthAccountName || undefined,
      }),
    });
    if (res.ok) {
      const json = (await res.json()) as { authorizeUrl: string; state: string };
      setPkceAuthUrl(json.authorizeUrl);
      setPkceState(json.state);
    }
  };

  const handleExchangePkceCallback = async (): Promise<void> => {
    if (!pastedCallbackInput.trim()) return;
    const res = await fetch('/api/oauth/pkce/exchange', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({
        providerId: selectedOAuthProvider,
        pastedCallbackUrlOrCode: pastedCallbackInput,
        state: pkceState || undefined,
        accountName: oauthAccountName || undefined,
      }),
    });
    if (res.ok) {
      showNotice(`Akun OAuth berhasil ditautkan & dienkripsi dengan AES-256-GCM!`);
      oauthDialogRef.current?.close();
      await fetchOverview();
    }
  };

  const handleStartDeviceCode = async (): Promise<void> => {
    const res = await fetch('/api/oauth/device/start', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({
        providerId: selectedOAuthProvider,
        accountName: oauthAccountName || undefined,
      }),
    });
    if (res.ok) {
      const json = (await res.json()) as {
        sessionId: string;
        userCode: string;
        verificationUri: string;
      };
      setDeviceSession(json);
    }
  };

  const handlePollDeviceCode = async (manualToken?: string): Promise<void> => {
    if (!deviceSession) return;
    const res = await fetch('/api/oauth/device/poll', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({
        sessionId: deviceSession.sessionId,
        manualAccessToken: manualToken,
      }),
    });
    if (res.ok) {
      const json = (await res.json()) as { status: string; message: string };
      showNotice(json.message);
      if (json.status === 'authorized') {
        oauthDialogRef.current?.close();
        await fetchOverview();
      }
    }
  };

  const handleUpdateComboStrategy = async (comboId: string, strategy: string): Promise<void> => {
    await fetch(`/api/admin/combos/${encodeURIComponent(comboId)}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({ strategy }),
    });
    showNotice(`Strategi routing combo diubah ke '${strategy}'`);
    await fetchOverview();
  };

  const handleCreateClientKey = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const res = await fetch('/api/admin/api-keys', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({
        name: newKeyName,
        dailyBudgetUsd: 0,
        monthlyBudgetUsd: 0,
        quotaSharePercent: newKeyQuotaShare,
      }),
    });
    if (res.ok) {
      const json = (await res.json()) as { rawKey: string };
      setCreatedRawKey(json.rawKey);
      showNotice('Client API Key BansosRouter (bansos_live_...) berhasil dibuat ($0 Lock)!');
      await fetchOverview();
    }
  };

  const handleRunCompressionSim = async (): Promise<void> => {
    const res = await fetch('/api/admin/compression/simulate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({
        prompt: simInput,
        profile: simProfile,
      }),
    });
    if (res.ok) {
      const json = (await res.json()) as typeof simResult;
      setSimResult(json);
    }
  };

  const handleSimulateModelLockout = async (conn: ConnectionItem): Promise<void> => {
    await fetch('/api/admin/resilience/simulate-lockout', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({
        connectionId: conn.id,
        provider: conn.provider,
        model: 'deepseek-r1',
      }),
    });
    showNotice(
      `Simulasi Layer 3 Lockout pada (${conn.name}, deepseek-r1) — model lain di akun ini tetap jalan!`
    );
    await fetchOverview();
  };

  const handleResetResilience = async (): Promise<void> => {
    await fetch('/api/admin/resilience/reset', {
      method: 'POST',
      headers: { 'x-admin-token': adminToken },
    });
    showNotice('Semua circuit breaker, cooldown, dan model lockout di KV telah di-reset!');
    await fetchOverview();
  };

  const handleRunPlayground = async (): Promise<void> => {
    setPgRunning(true);
    setPgOutput('');
    setPgHeaders({});
    try {
      let endpoint = '/v1/chat/completions';
      let payload: Record<string, unknown> = {
        model: pgModel,
        messages: [{ role: 'user', content: pgPrompt }],
      };

      if (pgProtocol === 'openai-responses') {
        endpoint = '/v1/responses';
        payload = {
          model: pgModel,
          input: pgPrompt,
        };
      } else if (pgProtocol === 'anthropic-messages') {
        endpoint = '/v1/messages';
        payload = {
          model: pgModel,
          max_tokens: 1024,
          messages: [{ role: 'user', content: pgPrompt }],
        };
      } else if (pgProtocol === 'gemini') {
        endpoint = `/v1beta/models/${encodeURIComponent(pgModel)}:generateContent`;
        payload = {
          contents: [{ role: 'user', parts: [{ text: pgPrompt }] }],
        };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${adminToken}`,
          'x-bansosrouter-strategy': pgStrategy,
        },
        body: JSON.stringify(payload),
      });

      const headersExtracted: Record<string, string> = {};
      [
        'x-bansosrouter-provider',
        'x-bansosrouter-model',
        'x-bansosrouter-strategy',
        'x-bansosrouter-cost-idr',
        'x-bansosrouter-cost-usd',
        'x-bansosrouter-latency-ms',
        'x-bansosrouter-tokens-saved',
        'x-bansosrouter-compression-layers',
      ].forEach((h) => {
        const val = res.headers.get(h);
        if (val) headersExtracted[h] = val;
      });
      setPgHeaders(headersExtracted);

      const json = await res.json();
      setPgOutput(JSON.stringify(json, null, 2));
      await fetchOverview();
    } catch (err) {
      setPgOutput(err instanceof Error ? err.message : 'Playground error');
    } finally {
      setPgRunning(false);
    }
  };

  const freeTiers = data?.catalogs.freeTiers ?? [];
  const bansosWatchlist = data?.catalogs.bansosWatchlist ?? [];

  const totalSelectedFreeDailyTokens = freeTiers.reduce(
    (acc, item) => (selectedFreeTiers[item.id] ? acc + item.dailyFreeTokens : acc),
    0
  );
  const totalSelectedFreeMonthlyTokens = freeTiers.reduce(
    (acc, item) =>
      selectedFreeTiers[item.id]
        ? acc + (item.monthlyFreeTokens || item.dailyFreeTokens * 30)
        : acc,
    0
  );

  const filteredFreeTiers = freeTiers.filter((ft) => {
    const matchesPolicy =
      bansosPolicyFilter === 'all' ||
      (bansosPolicyFilter === 'indo-local'
        ? ft.bansosCategory === 'indo-local'
        : ft.creditCardPolicy === bansosPolicyFilter);
    const q = bansosSearch.trim().toLowerCase();
    const matchesQuery =
      !q ||
      ft.name.toLowerCase().includes(q) ||
      ft.provider.toLowerCase().includes(q) ||
      ft.description.toLowerCase().includes(q) ||
      ft.featuredModels.some((m) => m.toLowerCase().includes(q)) ||
      (ft.sourceRefs ?? []).some((s) => s.toLowerCase().includes(q));
    return matchesPolicy && matchesQuery;
  });

  const renderTosBadge = (risk: 'safe' | 'caution' | 'tos_avoid'): React.ReactElement => {
    if (risk === 'safe') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-300 border border-emerald-500/30">
          <ShieldCheck className="h-3 w-3" /> safe
        </span>
      );
    }
    if (risk === 'caution') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-medium text-amber-300 border border-amber-500/30">
          <AlertTriangle className="h-3 w-3" /> caution
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-medium text-rose-300 border border-rose-500/30">
        <ShieldAlert className="h-3 w-3" /> tos: avoid
      </span>
    );
  };

  const renderCreditCardBadge = (
    policy: CreditCardPolicy,
    label: string
  ): React.ReactElement => {
    const styles: Record<CreditCardPolicy, string> = {
      no_cc: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      zero_key: 'bg-teal-500/15 text-teal-200 border-teal-500/30',
      oauth_free: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
      phone_only: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      free_credits: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    };
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
          styles[policy] ?? styles.no_cc
        }`}
      >
        <CreditCard className="h-3 w-3" /> {label}
      </span>
    );
  };

  const getAgentConfigSnippet = (): string => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://bansosrouter.workers.dev';
    const keyExample = createdRawKey || 'bansos_live_xxxxxxxxxxxxxxxx';
    if (selectedAgentSnippet === 'claude-code') {
      return `# Claude Code CLI — 100% Gratis via BansosRouter (/v1/messages)
export ANTHROPIC_BASE_URL="${origin}"
export ANTHROPIC_API_KEY="${keyExample}"
export ANTHROPIC_MODEL="bansos/coding"
claude`;
    }
    if (selectedAgentSnippet === 'codex') {
      return `# OpenAI Codex CLI — 100% Gratis via BansosRouter (/v1/responses)
export OPENAI_BASE_URL="${origin}/v1"
export OPENAI_API_KEY="${keyExample}"
codex --model bansos/coding`;
    }
    if (selectedAgentSnippet === 'cursor') {
      return `# Cursor / Windsurf — Override OpenAI Base URL
OpenAI Base URL : ${origin}/v1
API Key         : ${keyExample}
Custom Models   : bansos/auto, bansos/no-cc, bansos/coding, bansos/reasoning, bansos/fast, bansos/indo`;
    }
    if (selectedAgentSnippet === 'cline') {
      return `# Cline / Roo Code / Kilo Code (VS Code)
API Provider           : OpenAI Compatible
Base URL               : ${origin}/v1
API Key                : ${keyExample}
Model ID               : bansos/coding  (atau bansos/no-cc untuk 100% Tanpa Kartu Kredit)`;
    }
    return `# Aider / OpenCode CLI
export OPENAI_API_BASE="${origin}/v1"
export OPENAI_API_KEY="${keyExample}"
aider --model openai/bansos/coding`;
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
          <span>Memverifikasi Sesi Gudang BansosRouter ($0 / Rp 0 Lock)...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-emerald-500/30 bg-slate-900/85 p-8 shadow-2xl space-y-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 shadow-lg shadow-emerald-500/25">
              <Gift className="h-6 w-6" />
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-0.5 text-[11px] font-semibold text-emerald-300">
              100% Gratis • Rp 0 / $0 Lock
            </div>
            <h1 className="text-xl font-bold text-white">BansosRouter Admin Vault</h1>
            <p className="text-xs text-slate-400">
              Router AI Bantuan Sosial untuk Developer Jelata • Menggabungkan 24+ Provider LLM Gratis (~8.9+ Miliar Token/Bulan)
            </p>
          </div>

          <form onSubmit={(e) => void handleAdminLogin(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Username
              </label>
              <input
                type="text"
                required
                autoComplete="username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Password Admin
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {loginError && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 py-2.5 text-sm font-bold text-slate-950 hover:from-emerald-300 hover:to-teal-400 transition cursor-pointer"
            >
              Buka Gudang BansosRouter
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-slate-950 shadow-lg shadow-emerald-500/20">
              <Gift className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">BansosRouter</h1>
                <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 border border-emerald-500/30">
                  100% Free-Tier • Rp 0 ($0 Lock)
                </span>
                <span className="hidden md:inline-block rounded-md bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                  ~8.9+ Miliar Token Gratis/Bulan
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Router AI Bantuan Sosial untuk Developer Jelata • Sintesis 7 Repositori Bansos &amp; Free LLM
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <a
              href="/.well-known/agent.json"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-700 hover:text-white"
            >
              <Terminal className="h-3.5 w-3.5 text-emerald-400" /> A2A Card
            </a>
            <button
              onClick={() => void handleSeedDemoConnections()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" /> Klaim 7 Koneksi Bansos Starter
            </button>
            <button
              onClick={() => void fetchOverview()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Segarkan
            </button>
            <button
              onClick={() => handleAdminLogout()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 cursor-pointer"
            >
              <Lock className="h-3.5 w-3.5" /> Keluar
            </button>
          </div>
        </div>

        {/* Navigation Bar */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 overflow-x-auto">
          <nav className="flex gap-1 border-t border-slate-900 py-2">
            {(
              [
                { id: 'free-tiers', label: `Katalog Bansos LLM (${freeTiers.length || 24})`, icon: Gift },
                { id: 'overview', label: 'Ringkasan & Anti-Limit', icon: Activity },
                {
                  id: 'connections',
                  label: `Direktori Provider Gratis (${data?.catalogs.providerRegistry?.length ?? 200}+)`,
                  icon: Lock,
                },
                { id: 'combos', label: 'Combo bansos/* & 19 Strategi', icon: Cpu },
                { id: 'compression', label: 'Penghemat Kuota (10-Layer)', icon: Layers },
                { id: 'keys', label: 'Kunci API (bansos_live_)', icon: KeyRound },
                { id: 'playground', label: 'Playground Multi-Protokol', icon: Play },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-medium transition cursor-pointer ${
                    active
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-slate-900/95 px-4 py-3 text-sm text-emerald-200 shadow-xl">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 space-y-6">
        {/* TAB 1: KATALOG BANSOS LLM (24+ SUMBER RESMI & KOMUNITAS + KALKULATOR KUOTA) */}
        {activeTab === 'free-tiers' && (
          <div className="space-y-6">
            {/* Hero Banner & Monthly Token Quota Calculator */}
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-slate-900 p-6 flex flex-wrap items-center justify-between gap-4">
              <div className="max-w-3xl space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                  <Gift className="h-3.5 w-3.5" /> 100% Zero-Cost ($0 / Rp 0 Lock) • Tanpa Takut Tagihan Bengkak
                </div>
                <h2 className="text-xl font-bold text-white">
                  Gudang Bansos LLM &amp; Kalkulator Kuota Token Gratis Bulanan
                </h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Dikurasi langsung dari 7 sumber rujukan:{' '}
                  <code className="text-emerald-300">wauputr4/bansos</code>,{' '}
                  <code className="text-emerald-300">bansos.dev/list</code>,{' '}
                  <code className="text-emerald-300">tashfeenahmed/freellmapi</code>,{' '}
                  <code className="text-emerald-300">open-free-llm-api</code>,{' '}
                  <code className="text-emerald-300">nejib1/Free-LLM</code>,{' '}
                  <code className="text-emerald-300">mnfst/awesome-free-llm-apis</code>, dan{' '}
                  <code className="text-emerald-300">12britz/awesome-free-models</code>. Gabungkan semua
                  ke dalam 1 endpoint pintar <code className="text-white">bansos/auto</code> atau{' '}
                  <code className="text-white">bansos/no-cc</code>!
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="rounded-xl border border-emerald-500/40 bg-slate-950/90 px-4 py-3 text-right">
                  <p className="text-[11px] uppercase tracking-wider text-slate-400">
                    Kuota Harian Terpilih
                  </p>
                  <p className="text-xl font-extrabold text-emerald-400">
                    {(totalSelectedFreeDailyTokens / 1_000_000).toFixed(2)} Juta
                  </p>
                  <p className="text-[11px] text-slate-400">token / hari (Rp 0)</p>
                </div>

                <div className="rounded-xl border border-teal-500/40 bg-slate-950/90 px-4 py-3 text-right">
                  <p className="text-[11px] uppercase tracking-wider text-slate-400">
                    Akumulasi Kuota Bulanan
                  </p>
                  <p className="text-xl font-extrabold text-teal-300">
                    {(totalSelectedFreeMonthlyTokens / 1_000_000_000).toFixed(2)} Miliar
                  </p>
                  <p className="text-[11px] text-emerald-400 font-semibold">
                    token / bulan • $0.00 Lock
                  </p>
                </div>
              </div>
            </div>

            {/* Filter Kebijakan Kartu Kredit & Pencarian */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'all', label: `Semua Sumber (${freeTiers.length})` },
                      {
                        id: 'no_cc',
                        label: `Tanpa Kartu Kredit / No CC (${
                          freeTiers.filter((f) => f.creditCardPolicy === 'no_cc').length
                        })`,
                      },
                      {
                        id: 'zero_key',
                        label: `Zero-Key / Langsung Jalan (${
                          freeTiers.filter((f) => f.creditCardPolicy === 'zero_key').length
                        })`,
                      },
                      {
                        id: 'oauth_free',
                        label: `OAuth CLI Gratis (${
                          freeTiers.filter((f) => f.creditCardPolicy === 'oauth_free').length
                        })`,
                      },
                      {
                        id: 'phone_only',
                        label: `Verifikasi No HP Saja (${
                          freeTiers.filter((f) => f.creditCardPolicy === 'phone_only').length
                        })`,
                      },
                      {
                        id: 'free_credits',
                        label: `Kredit Bansos $10-$100 (${
                          freeTiers.filter((f) => f.creditCardPolicy === 'free_credits').length
                        })`,
                      },
                      {
                        id: 'indo-local',
                        label: `Lokal Indonesia & ASEAN (${
                          freeTiers.filter((f) => f.bansosCategory === 'indo-local').length
                        })`,
                      },
                    ] as const
                  ).map((pill) => {
                    const active = bansosPolicyFilter === pill.id;
                    return (
                      <button
                        key={pill.id}
                        type="button"
                        onClick={() => setBansosPolicyFilter(pill.id)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                          active
                            ? 'bg-emerald-500 text-slate-950 font-bold'
                            : 'border border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        {pill.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="search"
                    placeholder="Cari provider, model (DeepSeek, Qwen3, Gemini, Sahabat-AI)..."
                    value={bansosSearch}
                    onChange={(e) => setBansosSearch(e.target.value)}
                    className="w-full sm:w-72 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const onlyNoCc: Record<string, boolean> = {};
                      for (const ft of freeTiers) {
                        onlyNoCc[ft.id] =
                          ft.creditCardPolicy === 'no_cc' ||
                          ft.creditCardPolicy === 'zero_key' ||
                          ft.creditCardPolicy === 'oauth_free';
                      }
                      setSelectedFreeTiers(onlyNoCc);
                      showNotice('Kalkulator disetel hanya menghitung provider 100% Tanpa Kartu Kredit & Tanpa Verifikasi HP!');
                    }}
                    className="whitespace-nowrap rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                  >
                    Hitung Khusus No-CC
                  </button>
                </div>
              </div>

              {/* Grid Katalog Bansos */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {filteredFreeTiers.map((ft) => {
                  const checked = Boolean(selectedFreeTiers[ft.id]);
                  const connectedCount = (data?.connections ?? []).filter(
                    (c) => c.provider === ft.provider
                  ).length;
                  return (
                    <div
                      key={ft.id}
                      className={`rounded-2xl border p-5 transition flex flex-col justify-between gap-4 ${
                        checked
                          ? 'border-emerald-500/40 bg-slate-950/90'
                          : 'border-slate-800 bg-slate-950/40'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <label className="flex items-center gap-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setSelectedFreeTiers((prev) => ({
                                  ...prev,
                                  [ft.id]: e.target.checked,
                                }))
                              }
                              className="h-4 w-4 accent-emerald-500"
                            />
                            <div>
                              <span className="font-bold text-white text-sm">{ft.name}</span>
                              <span className="ml-2 font-mono text-[11px] text-emerald-400">
                                ({ft.provider})
                              </span>
                            </div>
                          </label>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {renderCreditCardBadge(ft.creditCardPolicy, ft.creditCardLabel)}
                            {renderTosBadge(ft.tosRisk)}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-emerald-300 font-medium">
                            ✓ {ft.verificationBadge}
                          </span>
                          {(ft.sourceRefs ?? []).map((ref) => (
                            <span
                              key={ref}
                              className="rounded bg-slate-900 border border-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400"
                            >
                              {ref}
                            </span>
                          ))}
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">{ft.description}</p>

                        {/* Featured Free Models */}
                        <div className="flex flex-wrap gap-1.5">
                          {ft.featuredModels.map((m) => (
                            <code
                              key={m}
                              className="rounded bg-slate-900 border border-slate-800 px-2 py-0.5 text-[11px] text-teal-300"
                            >
                              {m}
                            </code>
                          ))}
                        </div>

                        {/* Step-by-Step Cara Klaim Bansos */}
                        {ft.claimSteps?.length > 0 && (
                          <div className="rounded-xl border border-slate-800/90 bg-slate-900/50 p-3 space-y-1.5">
                            <p className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                              <BookOpen className="h-3.5 w-3.5 text-emerald-400" /> Cara Klaim &amp; Pasang:
                            </p>
                            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-400">
                              {ft.claimSteps.map((step, idx) => (
                                <li key={idx} className="leading-snug">
                                  {step}
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}

                        <p className="text-[11px] text-slate-400 italic">{ft.tosNote}</p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 pt-3 text-xs">
                        <div>
                          <span className="font-bold text-emerald-400">
                            +{(ft.dailyFreeTokens / 1000).toLocaleString()}K token/hari
                          </span>
                          <span className="text-slate-400 ml-1.5">
                            ({ft.rpmLimit} RPM • {ft.rpdLimit.toLocaleString()} RPD)
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <a
                            href={ft.signupUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-600 hover:text-white"
                          >
                            Klaim Key <ExternalLink className="h-3 w-3" />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleQuickConnectBansosItem(ft)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            {connectedCount > 0
                              ? `Terpasang (${connectedCount})`
                              : 'Pasang ke Router'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Watchlist Anti-Boncos (12britz/awesome-free-models Verification Notes) */}
            {bansosWatchlist.length > 0 && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-amber-300 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" /> Watchlist Anti-Boncos (Provider yang Sudah TIDAK Gratis Lagi)
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Diverifikasi berdasarkan laporan komunitas{' '}
                      <code>12britz/awesome-free-models</code> &amp; <code>wauputr4/bansos</code> agar
                      developer tidak terjebak top-up atau kartu kredit berbayar.
                    </p>
                  </div>
                  <span className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
                    Semua Dihapus dari Pool Berbayar &amp; Diganti Versi $0
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {bansosWatchlist.map((w) => (
                    <div
                      key={w.providerName}
                      className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-rose-300">{w.providerName}</span>
                        <span className="rounded bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-300">
                          {w.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-slate-400">{w.reason}</p>
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-emerald-200">
                        <strong className="text-emerald-300">Solusi Gratis di BansosRouter:</strong>{' '}
                        {w.freeAlternativeInBansosRouter}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* One-Click Coding Agent Config Generator */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white">
                    Generator Konfigurasi Coding Agent 1-Klik (Claude Code, Codex, Cursor, Cline, Aider)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Arahkan IDE atau CLI favoritmu ke BansosRouter dengan model virtual{' '}
                    <code className="text-emerald-300">bansos/coding</code> atau{' '}
                    <code className="text-emerald-300">bansos/no-cc</code>.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'claude-code', label: 'Claude Code' },
                      { id: 'codex', label: 'Codex CLI' },
                      { id: 'cursor', label: 'Cursor / Windsurf' },
                      { id: 'cline', label: 'Cline / Roo Code' },
                      { id: 'aider', label: 'Aider / OpenCode' },
                    ] as const
                  ).map((ag) => (
                    <button
                      key={ag.id}
                      type="button"
                      onClick={() => setSelectedAgentSnippet(ag.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                        selectedAgentSnippet === ag.id
                          ? 'bg-emerald-500 text-slate-950'
                          : 'border border-slate-800 bg-slate-950 text-slate-300'
                      }`}
                    >
                      {ag.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-emerald-300">
                  {getAgentConfigSnippet()}
                </pre>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(getAgentConfigSnippet());
                    showNotice('Konfigurasi CLI berhasil disalin ke clipboard!');
                  }}
                  className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25 cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" /> Salin
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: OVERVIEW & 3-LAYER RESILIENCE */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Koneksi Bansos Aktif
                </p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {data?.connections.length ?? 0}
                </p>
                <p className="mt-1 text-xs text-emerald-400">
                  Dienkripsi AES-256-GCM di Cloudflare D1
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Token Dihemat (10-Layer)
                </p>
                <p className="mt-2 text-3xl font-bold text-emerald-400">
                  {(data?.stats.totalTokensSaved ?? 0).toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Dari {(data?.stats.totalTokens ?? 0).toLocaleString()} total token diproses
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Latensi Gateway (EWMA)
                </p>
                <p className="mt-2 text-3xl font-bold text-white">
                  {Math.round(data?.stats.avgLatencyMs || 145)} ms
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Logging tanpa jeda via <code>waitUntil()</code>
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-emerald-300">
                  Tagihan Selamanya ($0 Lock)
                </p>
                <p className="mt-2 text-3xl font-bold text-emerald-400">
                  Rp 0 <span className="text-lg font-normal text-slate-400">($0.00)</span>
                </p>
                <p className="mt-1 text-xs text-emerald-300">
                  {data?.stats.totalRequests ?? 0} request • 100% Free-Tier Terkunci
                </p>
              </div>
            </div>

            {/* 3-Layer Self-Healing Resilience Panel */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    3-Layer Anti-Limit &amp; Self-Healing Resilience (Cloudflare KV)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Layer 1: Provider Circuit Breaker • Layer 2: Cooldown + Jitter • Layer 3:
                    Per-Model Lockout <code>(connection_id, model)</code> agar saat 1 model kena
                    HTTP 429, model gratis lain di akun yang sama tetap jalan!
                  </p>
                </div>
                <button
                  onClick={() => void handleResetResilience()}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 cursor-pointer"
                >
                  Reset Semua Lockout KV
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">
                      Layer 1: Circuit Breakers
                    </span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                      {data?.resilience.circuits.length ?? 0} aktif
                    </span>
                  </div>
                  {data?.resilience.circuits.length ? (
                    <ul className="mt-3 space-y-2 text-xs">
                      {data.resilience.circuits.map((c) => (
                        <li
                          key={c.provider}
                          className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-2 text-rose-200"
                        >
                          <strong>{c.provider}</strong>: {c.state} ({c.failures} gagal)
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-emerald-400">
                      ✓ Semua jalur provider Bansos CLOSED &amp; sehat
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">
                      Layer 2: Cooldown + Jitter
                    </span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                      {data?.resilience.cooldowns.length ?? 0} aktif
                    </span>
                  </div>
                  {data?.resilience.cooldowns.length ? (
                    <ul className="mt-3 space-y-2 text-xs">
                      {data.resilience.cooldowns.map((cd) => (
                        <li
                          key={cd.connectionId}
                          className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2 text-amber-200"
                        >
                          <strong>{cd.connectionId}</strong>: {cd.reason}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-emerald-400">
                      ✓ Tidak ada akun yang sedang cooldown
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">
                      Layer 3: Per-Model Lockouts
                    </span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                      {data?.resilience.modelLockouts.length ?? 0} terkunci
                    </span>
                  </div>
                  {data?.resilience.modelLockouts.length ? (
                    <ul className="mt-3 space-y-2 text-xs">
                      {data.resilience.modelLockouts.map((lk) => (
                        <li
                          key={`${lk.connectionId}:${lk.model}`}
                          className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2 text-emerald-200"
                        >
                          <strong>
                            ({lk.connectionId.slice(0, 12)}, {lk.model})
                          </strong>{' '}
                          istirahat — model lain di akun ini tetap melayani request!
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-emerald-400">
                      ✓ Tidak ada per-model lockout di KV
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Gateway Requests Telemetry Table */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <h2 className="text-base font-semibold text-white">
                Log Request Multi-Protokol Terbaru (Biaya Terkunci Rp 0)
              </h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-2 font-medium">Protokol</th>
                      <th className="pb-2 font-medium">Diminta → Dipakai</th>
                      <th className="pb-2 font-medium">Provider</th>
                      <th className="pb-2 font-medium">Strategi</th>
                      <th className="pb-2 font-medium">Token (Hemat)</th>
                      <th className="pb-2 font-medium">Biaya</th>
                      <th className="pb-2 font-medium">Latensi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(data?.recentLogs ?? []).map((log) => (
                      <tr key={log.id} className="text-slate-300">
                        <td className="py-2.5 font-mono text-[11px] text-emerald-300">
                          {log.inboundProtocol}
                        </td>
                        <td className="py-2.5">
                          <span className="text-slate-400">{log.modelRequested}</span> →{' '}
                          <span className="font-semibold text-white">{log.modelUsed}</span>
                        </td>
                        <td className="py-2.5">{log.provider}</td>
                        <td className="py-2.5">
                          <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px]">
                            {log.strategyUsed}
                          </span>
                        </td>
                        <td className="py-2.5">
                          {log.promptTokens + log.completionTokens}{' '}
                          <span className="text-emerald-400">(-{log.tokensSaved} hemat)</span>
                        </td>
                        <td className="py-2.5 font-semibold text-emerald-400">Rp 0</td>
                        <td className="py-2.5">{log.latencyMs} ms</td>
                      </tr>
                    ))}
                    {(!data?.recentLogs || data.recentLogs.length === 0) && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-500">
                          Belum ada log request. Klik &ldquo;Klaim 7 Koneksi Bansos Starter&rdquo; di kanan atas lalu coba kirim request di Playground!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: PROVIDER DIRECTORY, CONNECTIONS & CLOUD OAUTH WIZARD */}
        {activeTab === 'connections' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 to-slate-900 p-6">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Direktori Lengkap Provider Gratis &amp; Freemium ({data?.catalogs.providerRegistry?.length ?? 200}+ Provider Non-Paid)
                </h2>
                <p className="mt-1 text-xs text-slate-300">
                  Semua provider murni berbayar (<code>paid</code>) telah dibersihkan dari registri.
                  Mendukung OAuth CLI Gratis, API Key Free-Tier, Kredit Bansos ($10–$100), Zero-Key
                  Community, dan Local/Cloudflare Tunnel.
                </p>
              </div>
              <button
                onClick={() => openOAuthWizard('gemini-cli')}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                <Plus className="h-4 w-4" /> Buka Wizard OAuth Gratis (Device Code / PKCE)
              </button>
            </div>

            {/* Active Connections Table */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <h3 className="text-base font-semibold text-white">
                Akun Bansos Terhubung ({data?.connections.length ?? 0})
              </h3>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                {(data?.connections ?? []).map((conn) => {
                  const winPct =
                    conn.windowTokenLimit > 0
                      ? Math.min(100, (conn.tokensUsedWindow / conn.windowTokenLimit) * 100)
                      : 0;
                  const regInfo = (data?.catalogs.providerRegistry ?? []).find(
                    (p) => p.id === conn.provider
                  );
                  return (
                    <div
                      key={conn.id}
                      className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold text-white shadow"
                            style={{ backgroundColor: regInfo?.color ?? '#10B981' }}
                          >
                            {regInfo?.textIcon ?? conn.provider.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white text-sm">{conn.name}</span>
                              {renderTosBadge(conn.tosRisk)}
                            </div>
                            <p className="mt-1 text-xs text-slate-400">
                              Provider: <code className="text-emerald-300">{conn.provider}</code> •
                              Auth: <code>{conn.authType}</code> • Biaya: <strong className="text-emerald-400">Rp 0</strong>
                            </p>
                            {conn.sdkPersona && (
                              <p className="mt-1 text-[11px] text-cyan-300/90 font-mono">
                                🛡️ SDK Persona #{conn.sdkPersonaSlot ?? 0}: {conn.sdkPersona}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
                          {conn.status}
                        </span>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                          <span>
                            Kuota Jendela 5 Jam: {conn.tokensUsedWindow.toLocaleString()} /{' '}
                            {conn.windowTokenLimit.toLocaleString()}
                          </span>
                          <span>EWMA {Math.round(conn.avgLatencyMs)}ms</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400"
                            style={{ width: `${winPct}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                        <button
                          onClick={() => void handleSimulateModelLockout(conn)}
                          className="text-xs text-amber-300 hover:underline cursor-pointer"
                        >
                          Tes Layer 3 Model Lockout (deepseek-r1)
                        </button>
                        <button
                          onClick={async () => {
                            await fetch(`/api/admin/connections/${conn.id}`, {
                              method: 'DELETE',
                              headers: { 'x-admin-token': adminToken },
                            });
                            await fetchOverview();
                          }}
                          className="inline-flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Hapus
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Direct API Key / Token / Cloudflare Tunnel Vault Form */}
            <form
              ref={connectFormRef}
              onSubmit={(e) => void handleAddApiKeyConnection(e)}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Tambah Koneksi Provider Gratis (Dienkripsi WebCrypto AES-256-GCM)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Klik kartu di bawah atau dari tab Katalog Bansos untuk mengisi otomatis. Untuk
                    provider Zero-Key (Pollinations, MLab, FreeAI), kolom API Key boleh dikosongkan.
                  </p>
                </div>
                <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-mono text-emerald-300">
                  Terpilih: {connProvider}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <select
                  value={connProvider}
                  onChange={(e) => {
                    const pid = e.target.value;
                    setConnProvider(pid);
                    const found = (data?.catalogs.providerRegistry ?? []).find((p) => p.id === pid);
                    if (found) {
                      setConnTier('free');
                      setConnBaseUrl(found.baseUrl.startsWith('binding://') ? '' : found.baseUrl);
                    }
                  }}
                  className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  {(data?.catalogs.providerRegistry ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.category.toUpperCase()}] {p.name} ({p.id})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Label Akun (mis. Groq Bansos #1)"
                  value={connName}
                  onChange={(e) => setConnName(e.target.value)}
                  className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
                />
                <input
                  type="password"
                  placeholder="API Key Gratis (opsional utk Zero-Key)"
                  value={connApiKey}
                  onChange={(e) => setConnApiKey(e.target.value)}
                  className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
                />
                <input
                  type="text"
                  placeholder="Base URL (otomatis terisi)"
                  value={connBaseUrl}
                  onChange={(e) => setConnBaseUrl(e.target.value)}
                  className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                >
                  Enkripsi &amp; Simpan ke D1
                </button>
              </div>
            </form>

            {/* CATEGORIZED PROVIDER DIRECTORY (FREE / FREEMIUM / OAUTH ONLY) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-white">
                    Direktori Semua Provider Gratis &amp; Komunitas ({data?.catalogs.providerRegistry?.length ?? 200} Provider)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Klik kartu provider mana saja untuk menghubungkannya via OAuth, API Key Gratis,
                    Zero-Key, atau Cloudflare Tunnel.
                  </p>
                </div>
                <input
                  type="search"
                  placeholder="Cari provider (mis. Groq, Chutes, Pollinations, Qwen, AionLabs, Ollama...)"
                  value={providerSearch}
                  onChange={(e) => setProviderSearch(e.target.value)}
                  className="w-full sm:w-80 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap gap-1.5">
                {(data?.catalogs.providerCategories ?? []).map((cat) => {
                  const count =
                    cat.id === 'all'
                      ? (data?.catalogs.providerRegistry?.length ?? 0)
                      : (data?.catalogs.providerRegistry ?? []).filter((p) => p.category === cat.id)
                          .length;
                  if (cat.id !== 'all' && count === 0) return null;
                  const active = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                        active
                          ? 'bg-emerald-500 text-slate-950 font-bold'
                          : 'border border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      {cat.shortLabel} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Grouped Provider Sections */}
              <div className="space-y-8">
                {(data?.catalogs.providerCategories ?? [])
                  .filter((c) => c.id !== 'all' && (selectedCategory === 'all' || selectedCategory === c.id))
                  .map((cat) => {
                    const q = providerSearch.trim().toLowerCase();
                    const items = (data?.catalogs.providerRegistry ?? []).filter(
                      (p) =>
                        p.category === cat.id &&
                        (!q ||
                          p.name.toLowerCase().includes(q) ||
                          p.id.toLowerCase().includes(q) ||
                          p.description.toLowerCase().includes(q) ||
                          p.defaultModels.some((m) => m.toLowerCase().includes(q)))
                    );
                    if (items.length === 0) return null;

                    return (
                      <div key={cat.id} className="space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <div>
                            <h4 className="text-sm font-bold text-white">
                              {cat.label}{' '}
                              <span className="ml-1.5 rounded bg-slate-800 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                                {items.length}
                              </span>
                            </h4>
                            <p className="text-[11px] text-slate-400">{cat.description}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                          {items.map((p) => {
                            const connectedCount = (data?.connections ?? []).filter(
                              (c) => c.provider === p.id
                            ).length;
                            return (
                              <div
                                key={p.id}
                                onClick={() => handleQuickSelectProvider(p)}
                                className={`group relative flex flex-col justify-between rounded-xl border p-3.5 transition cursor-pointer ${
                                  connectedCount > 0
                                    ? 'border-emerald-500/40 bg-slate-950/90 hover:border-emerald-400'
                                    : 'border-slate-800/90 bg-slate-950/60 hover:border-emerald-500/50 hover:bg-slate-950'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div
                                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold text-white shadow-md"
                                    style={{ backgroundColor: p.color }}
                                  >
                                    {p.textIcon}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-1">
                                      <p className="truncate text-xs font-bold text-white group-hover:text-emerald-300">
                                        {p.name}
                                      </p>
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-1">
                                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">
                                        {p.tier === 'free' ? '100% FREE' : p.tier}
                                      </span>
                                      {renderTosBadge(p.tosRisk)}
                                    </div>
                                  </div>
                                </div>

                                <p className="mt-2.5 line-clamp-2 text-[11px] text-slate-400">
                                  {p.description}
                                </p>

                                <div className="mt-3 flex items-center justify-between border-t border-slate-800/70 pt-2 text-[11px]">
                                  {connectedCount > 0 ? (
                                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                                      ● {connectedCount} Terhubung
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 group-hover:text-emerald-300 font-medium">
                                      + Hubungkan ({p.authType})
                                    </span>
                                  )}
                                  <a
                                    href={p.website}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-slate-400 hover:text-white"
                                    title={p.website}
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: 19 ROUTING STRATEGIES & VIRTUAL BANSOS/* COMBOS */}
        {activeTab === 'combos' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <h2 className="text-base font-semibold text-white">
                Virtual Combo <code>bansos/*</code> &amp; 19 Algoritma Routing Anti-Limit
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Gunakan nama model virtual seperti <code>bansos/auto</code>,{' '}
                <code>bansos/no-cc</code>, <code>bansos/coding</code>,{' '}
                <code>bansos/reasoning</code>, <code>bansos/fast</code>,{' '}
                <code>bansos/million-context</code>, atau <code>bansos/indo</code> di aplikasi Anda.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                {(data?.combos ?? []).map((combo) => (
                  <div
                    key={combo.id}
                    className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <code className="text-sm font-bold text-emerald-400">{combo.slug}</code>
                        <h4 className="text-xs font-medium text-slate-200">{combo.name}</h4>
                      </div>
                      <select
                        value={combo.strategy}
                        onChange={(e) => void handleUpdateComboStrategy(combo.id, e.target.value)}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-emerald-300"
                      >
                        {(data?.catalogs.strategies ?? []).map((st) => (
                          <option key={st} value={st}>
                            Strategi: {st}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-xs text-slate-400">{combo.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: 10-LAYER PURE-TS TOKEN COMPRESSION STUDIO */}
        {activeTab === 'compression' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    10-Layer Pure-TypeScript Penghemat Kuota Token Bansos
                  </h2>
                  <p className="text-xs text-slate-400">
                    Agar kuota harian gratis RPD/TPM tidak cepat habis: Session-Dedup → CCR (KV) →
                    Lite → RTK → Responses-Tool → Headroom Tabular Codec → Relevance → Caveman →
                    Aggressive → Ultra.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={simProfile}
                    onChange={(e) => setSimProfile(e.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                  >
                    <option value="lite">Profil: lite (3 layer)</option>
                    <option value="balanced">Profil: balanced (6 layer)</option>
                    <option value="aggressive">Profil: aggressive (9 layer)</option>
                    <option value="ultra">Profil: ultra (Semua 10 layer)</option>
                  </select>
                  <button
                    onClick={() => void handleRunCompressionSim()}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                  >
                    Simulasikan Kompresi
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Prompt Mentah (JSON Array Seragam + Log CLI + Basa-basi)
                  </label>
                  <textarea
                    rows={10}
                    value={simInput}
                    onChange={(e) => setSimInput(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Hasil Kompresi &amp; Headroom Tabular Codec
                  </label>
                  <textarea
                    rows={10}
                    readOnly
                    value={
                      simResult
                        ? simResult.compressedText
                        : 'Klik "Simulasikan Kompresi" untuk melihat berapa banyak kuota token gratis yang dihemat...'
                    }
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-emerald-300"
                  />
                </div>
              </div>

              {simResult && (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs">
                  <div>
                    <strong>Asli:</strong> {simResult.stats.originalTokens} token →{' '}
                    <strong>Terkompresi:</strong> {simResult.stats.compressedTokens} token (
                    <span className="font-bold text-emerald-300">
                      Hemat {simResult.stats.tokensSaved} token / {simResult.stats.savingsPercent}%
                    </span>
                    )
                  </div>
                  <div className="text-slate-300">
                    Layer Aktif: <code>{simResult.stats.layersApplied.join(' → ')}</code>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: CLIENT API KEYS & QUOTA-SHARE */}
        {activeTab === 'keys' && (
          <div className="space-y-6">
            <form
              onSubmit={(e) => void handleCreateClientKey(e)}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4"
            >
              <h2 className="text-base font-semibold text-white">
                Buat Kunci API Client (<code>bansos_live_...</code>) — Terkunci Rp 0 ($0.00 Lock) &amp;
                Quota-Share
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Nama Kunci (mis. Tim Riset / Claude Code CLI)"
                  className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
                />
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={newKeyQuotaShare}
                  onChange={(e) => setNewKeyQuotaShare(Number(e.target.value))}
                  placeholder="Jatah Kuota Bansos % (1-100)"
                  className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                >
                  Buat Client Key (bansos_live_...)
                </button>
              </div>

              {createdRawKey && (
                <div className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                  <div>
                    <span className="font-semibold">Kunci API Baru (salin sekarang): </span>
                    <code className="font-mono text-white">{createdRawKey}</code>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(createdRawKey);
                      showNotice('Kunci API berhasil disalin ke clipboard!');
                    }}
                    className="inline-flex items-center gap-1 rounded bg-emerald-500/20 px-2.5 py-1 text-emerald-200 cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" /> Salin
                  </button>
                </div>
              )}
            </form>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
              <h3 className="text-base font-semibold text-white">Daftar Kunci API Client Aktif</h3>
              <div className="mt-4 space-y-3">
                {(data?.apiKeys ?? []).map((k) => (
                  <div
                    key={k.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-white">{k.name}</p>
                      <p className="text-slate-400 font-mono">{k.keyPrefix}</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <span>
                        Biaya Terkunci: <strong className="text-emerald-400">Rp 0 ($0.00)</strong>
                      </span>
                      <span>
                        Jatah Kuota Pool: <strong>{k.quotaSharePercent}%</strong>
                      </span>
                      <span>
                        Token Dihemat: <strong className="text-emerald-400">{k.totalTokensSaved}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: LIVE MULTI-PROTOCOL PLAYGROUND */}
        {activeTab === 'playground' && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
            <h2 className="text-base font-semibold text-white">
              Live Multi-Protocol Bansos Playground (Rp 0 / $0 Lock)
            </h2>
            <p className="text-xs text-slate-400">
              Uji translasi dua arah antar protokol OpenAI Chat (<code>/v1/chat/completions</code>),
              OpenAI Responses (<code>/v1/responses</code> — Codex CLI), Anthropic Messages (
              <code>/v1/messages</code> — Claude Code), dan Google Gemini (
              <code>/v1beta/models/...</code>).
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <select
                value={pgProtocol}
                onChange={(e) => setPgProtocol(e.target.value as typeof pgProtocol)}
                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
              >
                <option value="openai-chat">Protokol: OpenAI Chat (/v1/chat/completions)</option>
                <option value="openai-responses">
                  Protokol: OpenAI Responses (/v1/responses • Codex CLI)
                </option>
                <option value="anthropic-messages">
                  Protokol: Anthropic Messages (/v1/messages • Claude Code)
                </option>
                <option value="gemini">
                  Protokol: Google Gemini (/v1beta/models/:generateContent)
                </option>
              </select>

              <select
                value={pgModel}
                onChange={(e) => setPgModel(e.target.value)}
                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
              >
                {(
                  data?.catalogs.virtualAutoCombos ?? [
                    'bansos/auto',
                    'bansos/no-cc',
                    'bansos/coding',
                    'bansos/reasoning',
                    'bansos/fast',
                    'bansos/million-context',
                    'bansos/indo',
                  ]
                ).map((m) => (
                  <option key={m} value={m}>
                    Combo: {m}
                  </option>
                ))}
                <option value="qwen-3-coder-480b">Model: qwen-3-coder-480b ($0)</option>
                <option value="deepseek-r1">Model: deepseek-r1 ($0)</option>
                <option value="gemini-2.5-pro">Model: gemini-2.5-pro ($0)</option>
                <option value="llama-3.3-70b-versatile">Model: llama-3.3-70b-versatile ($0)</option>
              </select>

              <select
                value={pgStrategy}
                onChange={(e) => setPgStrategy(e.target.value)}
                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white"
              >
                {(data?.catalogs.strategies ?? ['reset-aware', 'p2c', 'cache-optimized']).map(
                  (s) => (
                    <option key={s} value={s}>
                      Strategi: {s}
                    </option>
                  )
                )}
              </select>

              <button
                onClick={() => void handleRunPlayground()}
                disabled={pgRunning}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
              >
                {pgRunning ? 'Merutekan ke Pool Bansos...' : 'Kirim Request Gratis (Rp 0)'}
              </button>
            </div>

            <textarea
              rows={3}
              value={pgPrompt}
              onChange={(e) => setPgPrompt(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-white"
            />

            {Object.keys(pgHeaders).length > 0 && (
              <div className="flex flex-wrap gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
                {Object.entries(pgHeaders).map(([k, v]) => (
                  <span
                    key={k}
                    className="rounded bg-slate-950/90 px-2.5 py-1 font-mono text-[11px] text-emerald-300"
                  >
                    {k}: <strong>{v}</strong>
                  </span>
                ))}
              </div>
            )}

            <pre className="max-h-96 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-emerald-300">
              {pgOutput || '// Respons JSON dan Header Transparansi X-BansosRouter-* akan tampil di sini'}
            </pre>
          </div>
        )}
      </main>

      {/* NATIVE MODAL DIALOG FOR CLOUD OAUTH WIZARD (Device Code + PKCE Paste-Callback URL) */}
      <dialog
        ref={oauthDialogRef}
        closedby="any"
        aria-labelledby="oauthDialogTitle"
        className="m-auto w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 id="oauthDialogTitle" className="text-base font-bold text-white">
              Wizard OAuth CLI Gratis (Device Code &amp; PKCE Paste-Callback)
            </h2>
            <form method="dialog">
              <button
                type="submit"
                className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                Tutup (Esc)
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Provider OAuth</label>
              <select
                value={selectedOAuthProvider}
                onChange={(e) => {
                  setSelectedOAuthProvider(e.target.value);
                  setPkceAuthUrl('');
                  setDeviceSession(null);
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              >
                {(data?.catalogs.oauthProviders ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.flowType === 'pkce_paste' ? 'PKCE + Paste URL' : 'Device Code'})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Label Akun</label>
              <input
                type="text"
                placeholder="mis. Akun Google / Qwen #1"
                value={oauthAccountName}
                onChange={(e) => setOAuthAccountName(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          {/* PKCE Redirect + Paste-Callback URL Helper */}
          {['claude-code', 'codex', 'gemini-cli', 'antigravity'].includes(
            selectedOAuthProvider
          ) ? (
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs">
              <p className="text-slate-300">
                <strong>Langkah 1:</strong> Buat tautan otorisasi PKCE S256 dan buka di browser Anda.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleStartPkce()}
                  className="rounded-lg bg-emerald-500 px-3.5 py-2 font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
                >
                  Buat Link Login PKCE S256
                </button>
                {pkceAuthUrl && (
                  <a
                    href={pkceAuthUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 font-semibold text-emerald-300"
                  >
                    Buka Halaman Login <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>

              <p className="text-slate-300 pt-2">
                <strong>Langkah 2 (Tempel Callback URL / Kode):</strong> Saat browser diarahkan ke{' '}
                <code>http://localhost:.../?code=...</code>, salin URL lengkap dari address bar dan
                tempel di bawah ini!
              </p>
              <input
                type="text"
                placeholder="Tempel http://localhost:1455/auth/callback?code=...&state=... atau kode"
                value={pastedCallbackInput}
                onChange={(e) => setPastedCallbackInput(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-white"
              />
              <button
                type="button"
                onClick={() => void handleExchangePkceCallback()}
                className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                Tukar Kode &amp; Simpan Akun OAuth Terenkripsi
              </button>
            </div>
          ) : (
            /* Device Code Poll Flow */
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs">
              <p className="text-slate-300">
                Mulai otorisasi Device Code untuk <strong>{selectedOAuthProvider}</strong>:
              </p>
              <button
                type="button"
                onClick={() => void handleStartDeviceCode()}
                className="rounded-lg bg-emerald-500 px-3.5 py-2 font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer"
              >
                Minta Device Code
              </button>

              {deviceSession && (
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span>
                      Kode Anda:{' '}
                      <strong className="font-mono text-base text-emerald-400">
                        {deviceSession.userCode}
                      </strong>
                    </span>
                    <a
                      href={deviceSession.verificationUri}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-emerald-300 underline"
                    >
                      Buka {deviceSession.verificationUri} <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handlePollDeviceCode()}
                    className="w-full rounded-lg bg-emerald-500 px-4 py-2 font-bold text-slate-950 cursor-pointer"
                  >
                    Cek Status Otorisasi
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </dialog>
    </div>
  );
}
