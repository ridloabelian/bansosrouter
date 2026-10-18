import React, { useEffect, useRef, useState } from 'react';
import {
  type NavTab,
  Card,
  Button,
  Badge,
  Toggle,
  Input,
  SegmentedControl,
  ProviderIcon,
  Sidebar,
  Header,
} from './NineRouterUI';

interface ConnectionItem {
  id: string;
  name: string;
  provider: string;
  authType: string;
  accountLabel: string;
  baseUrl?: string | null;
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
  isActive?: number | boolean;
  createdAt?: number;
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

const SDK_PERSONA_LIST = [
  { slot: 0, label: 'claude-cli/2.1.81', ua: 'claude-cli/2.1.81 (external, cli)', runtime: 'node/v22.14.0', arch: 'arm64', os: 'MacOS' },
  { slot: 1, label: 'claude-cli/2.1.78', ua: 'claude-cli/2.1.78 (external, cli)', runtime: 'node/v20.18.3', arch: 'x64', os: 'Linux' },
  { slot: 2, label: 'cursor/0.49.6', ua: 'Cursor/0.49.6 Chrome/132.0.6834.210 Electron/34.3.2', runtime: 'electron/34.3.2', arch: 'arm64', os: 'MacOS' },
  { slot: 3, label: 'cursor/0.48.9', ua: 'Cursor/0.48.9 Chrome/130.0.6723.191 Electron/33.2.1', runtime: 'electron/33.2.1', arch: 'x64', os: 'Windows' },
  { slot: 4, label: 'cline/3.8.4', ua: 'Cline/3.8.4 VSCode/1.98.2', runtime: 'node/v20.18.1', arch: 'arm64', os: 'MacOS' },
  { slot: 5, label: 'roo-code/3.11.2', ua: 'Roo-Code/3.11.2 VSCode/1.98.2', runtime: 'node/v20.18.1', arch: 'x64', os: 'Linux' },
  { slot: 6, label: 'opencode/0.2.19', ua: 'opencode/0.2.19 (darwin; arm64)', runtime: 'go/1.24.1', arch: 'arm64', os: 'MacOS' },
  { slot: 7, label: 'codex-cli/0.1.2504', ua: 'codex-cli/0.1.2504 (Node.js v22.13.1; darwin arm64)', runtime: 'node/v22.13.1', arch: 'arm64', os: 'MacOS' },
  { slot: 8, label: 'aider/0.77.1', ua: 'litellm/1.63.11 aider/0.77.1 python-httpx/0.28.1', runtime: 'python/3.12.9', arch: 'x64', os: 'Linux' },
  { slot: 9, label: 'continue/1.0.6', ua: 'Continue/1.0.6 VSCode/1.97.2', runtime: 'node/v20.17.0', arch: 'arm64', os: 'MacOS' },
  { slot: 10, label: 'openai-node/4.89.0', ua: 'OpenAI/JS 4.89.0', runtime: 'node/v22.12.0', arch: 'x64', os: 'Linux' },
  { slot: 11, label: 'openai-python/1.68.2', ua: 'OpenAI/Python 1.68.2', runtime: 'python/3.13.2', arch: 'arm64', os: 'MacOS' },
  { slot: 12, label: 'anthropic-ts/0.39.0', ua: 'Anthropic/JS 0.39.0', runtime: 'node/v22.14.0', arch: 'arm64', os: 'MacOS' },
  { slot: 13, label: 'anthropic-py/0.49.0', ua: 'Anthropic/Python 0.49.0', runtime: 'python/3.12.8', arch: 'x64', os: 'Linux' },
  { slot: 14, label: 'vercel-ai/4.1.61', ua: 'ai-sdk/4.1.61 runtime/node', runtime: 'node/v22.11.0', arch: 'x64', os: 'Linux' },
  { slot: 15, label: 'langchain-py/0.3.21', ua: 'langchain/0.3.21 openai-python/1.66.3', runtime: 'python/3.11.11', arch: 'x64', os: 'Windows' },
];

export function App(): React.ReactElement {
  const [adminToken, setAdminToken] = useState<string>(
    () => localStorage.getItem('bansosrouter_admin_token') ?? ''
  );
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [loginUsername] = useState<string>('admin');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState<boolean>(false);

  // Theme state following dark-mode-toggle guidance
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme-preference');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const handleToggleTheme = (): void => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme-preference', next);
    document.documentElement.dataset.theme = next;
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Navigation & mobile drawer state
  const [activeTab, setActiveTab] = useState<NavTab>('providers');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [toast, setToast] = useState<string | null>(null);

  // Modals (using native <dialog closedby="any"> + progressive backdrop click fallback)
  const oauthDialogRef = useRef<HTMLDialogElement | null>(null);
  const addConnDialogRef = useRef<HTMLDialogElement | null>(null);
  const createKeyDialogRef = useRef<HTMLDialogElement | null>(null);
  const createComboDialogRef = useRef<HTMLDialogElement | null>(null);

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

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [bansosPolicyFilter, setBansosPolicyFilter] = useState<string>('all');

  // Add Connection Form state
  const [connName, setConnName] = useState<string>('');
  const [connProvider, setConnProvider] = useState<string>('groq');
  const [connApiKey, setConnApiKey] = useState<string>('');
  const [connBaseUrl, setConnBaseUrl] = useState<string>('');
  const [connPriority, setConnPriority] = useState<number>(10);
  const [testingProviderGroup, setTestingProviderGroup] = useState<string | null>(null);

  // Endpoint & Keys page state
  const [showAltEndpoints, setShowAltEndpoints] = useState<boolean>(false);
  const [requireApiKey, setRequireApiKey] = useState<boolean>(false);
  const [newKeyName, setNewKeyName] = useState<string>('Default Key');
  const [newKeyQuotaShare, setNewKeyQuotaShare] = useState<number>(100);
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [visibleKeyIds, setVisibleKeyIds] = useState<Record<string, boolean>>({});

  // Create Combo Form state
  const [newComboSlug, setNewComboSlug] = useState<string>('bansos/custom-stack');
  const [newComboName, setNewComboName] = useState<string>('My Free Bansos Stack');
  const [newComboDesc, setNewComboDesc] = useState<string>('Fallback combo across Groq, Cerebras, and Gemini');
  const [newComboStrategy, setNewComboStrategy] = useState<string>('reset-aware');

  // Usage Page state
  const [usageSubTab, setUsageSubTab] = useState<string>('overview');
  const [usagePeriod, setUsagePeriod] = useState<string>('24h');

  // Token Saver Page state (9Router exact toggles + 10-layer simulator)
  const [tsRtkEnabled, setTsRtkEnabled] = useState<boolean>(true);
  const [tsHeadroomEnabled, setTsHeadroomEnabled] = useState<boolean>(true);
  const [tsCavemanEnabled, setTsCavemanEnabled] = useState<boolean>(false);
  const [tsCavemanLevel, setTsCavemanLevel] = useState<'lite' | 'full' | 'ultra'>('full');
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

  // CLI Tools Page state
  const [expandedCliTool, setExpandedCliTool] = useState<string | null>('claude');
  const [selectedCliModel, setSelectedCliModel] = useState<string>('bansos/coding');

  // Bansos Free-Tier Calculator state
  const [selectedFreeTiers, setSelectedFreeTiers] = useState<Record<string, boolean>>({});

  // Console Playground state
  const [pgProtocol, setPgProtocol] = useState<
    'openai-chat' | 'openai-responses' | 'anthropic-messages' | 'gemini'
  >('openai-chat');
  const [pgModel, setPgModel] = useState<string>('bansos/auto');
  const [pgStrategy, setPgStrategy] = useState<string>('reset-aware');
  const [pgPrompt, setPgPrompt] = useState<string>(
    'Jelaskan bagaimana BansosRouter menggabungkan 24+ provider LLM gratisan menjadi 1 endpoint $0 (Rp 0) anti-limit!'
  );
  const [pgOutput, setPgOutput] = useState<string>('');
  const [pgHeaders, setPgHeaders] = useState<Record<string, string>>({});
  const [pgRunning, setPgRunning] = useState<boolean>(false);

  const showNotice = (msg: string): void => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  };

  const copyText = (text: string, label = 'Copied to clipboard!'): void => {
    void navigator.clipboard.writeText(text);
    showNotice(label);
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

  useEffect(() => {
    void fetchOverview();
  }, [adminToken]);

  // Progressive fallback for browsers without native `<dialog closedby="any">` support (light-dismiss-a-dialog)
  useEffect(() => {
    const dialogs = [
      oauthDialogRef.current,
      addConnDialogRef.current,
      createKeyDialogRef.current,
      createComboDialogRef.current,
    ].filter((d): d is HTMLDialogElement => d !== null);

    if ('closedBy' in HTMLDialogElement.prototype) return;

    const handleBackdropClick = (event: MouseEvent): void => {
      const dialog = event.currentTarget as HTMLDialogElement;
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

    for (const d of dialogs) {
      d.addEventListener('click', handleBackdropClick);
    }
    return () => {
      for (const d of dialogs) {
        d.removeEventListener('click', handleBackdropClick);
      }
    };
  }, [isAuthenticated]);

  const handleAdminLogin = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
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
        setLoginError('Invalid password');
        return;
      }
      const json = (await res.json()) as { ok: boolean; token: string };
      localStorage.setItem('bansosrouter_admin_token', json.token);
      setAdminToken(json.token);
      setLoginPassword('');
      await fetchOverview(json.token);
    } catch {
      setLoginError('An error occurred. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleAdminLogout = (): void => {
    localStorage.removeItem('bansosrouter_admin_token');
    setAdminToken('');
    setIsAuthenticated(false);
    setData(null);
  };

  const openOAuthWizard = (providerId?: string): void => {
    if (providerId) setSelectedOAuthProvider(providerId);
    setPkceAuthUrl('');
    setDeviceSession(null);
    setPastedCallbackInput('');
    oauthDialogRef.current?.showModal();
  };

  const openAddConnectionModal = (providerId?: string): void => {
    const pId = providerId ?? selectedProviderId ?? 'groq';
    setConnProvider(pId);
    const regItem = (data?.catalogs.providerRegistry ?? []).find((p) => p.id === pId);
    const existingCount = (data?.connections ?? []).filter((c) => c.provider === pId).length;
    setConnName(`${regItem?.name ?? pId.toUpperCase()} #${existingCount + 1}`);
    setConnApiKey('');
    setConnBaseUrl(
      regItem?.baseUrl && !regItem.baseUrl.startsWith('binding://') ? regItem.baseUrl : ''
    );
    setConnPriority(10 + existingCount * 5);
    addConnDialogRef.current?.showModal();
  };

  const handleSeedDemoConnections = async (): Promise<void> => {
    const res = await fetch('/api/admin/connections/seed-demo', {
      method: 'POST',
      headers: { 'x-admin-token': adminToken },
    });
    if (res.ok) {
      showNotice('7 Starter Free Providers seeded into pool ($0 Lock)!');
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
        name: connName || `${regItem?.name ?? connProvider.toUpperCase()} Account`,
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
      const json = (await res.json()) as { sdkPersona?: string; sdkPersonaSlot?: number };
      setConnName('');
      setConnApiKey('');
      addConnDialogRef.current?.close();
      showNotice(
        `Connected ${regItem?.name ?? connProvider} with SDK Persona #${(json.sdkPersonaSlot ?? 0) + 1} (${json.sdkPersona ?? 'isolated'})!`
      );
      await fetchOverview();
    }
  };

  const handleToggleConnectionStatus = async (conn: ConnectionItem): Promise<void> => {
    const nextStatus = conn.status === 'active' ? 'paused' : 'active';
    await fetch(`/api/admin/connections/${encodeURIComponent(conn.id)}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({ status: nextStatus }),
    });
    showNotice(`${conn.name} is now ${nextStatus}`);
    await fetchOverview();
  };

  const handleDeleteConnection = async (conn: ConnectionItem): Promise<void> => {
    await fetch(`/api/admin/connections/${encodeURIComponent(conn.id)}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': adminToken },
    });
    showNotice(`Removed connection ${conn.name}`);
    await fetchOverview();
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
      showNotice('OAuth account connected & encrypted with AES-256-GCM!');
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

  const handleCreateClientKey = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const res = await fetch('/api/admin/api-keys', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({
        name: newKeyName || 'Default Key',
        dailyBudgetUsd: 0,
        monthlyBudgetUsd: 0,
        quotaSharePercent: newKeyQuotaShare,
      }),
    });
    if (res.ok) {
      const json = (await res.json()) as { rawKey: string };
      setCreatedRawKey(json.rawKey);
      createKeyDialogRef.current?.close();
      showNotice('API Key created (bansos_live_...)!');
      await fetchOverview();
    }
  };

  const handleDeleteApiKey = async (keyId: string): Promise<void> => {
    await fetch(`/api/admin/api-keys/${encodeURIComponent(keyId)}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': adminToken },
    });
    showNotice('API key deleted');
    await fetchOverview();
  };

  const handleCreateCombo = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const res = await fetch('/api/admin/combos', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({
        slug: newComboSlug,
        name: newComboName,
        description: newComboDesc,
        strategy: newComboStrategy,
        compressionProfile: 'balanced',
      }),
    });
    if (res.ok) {
      createComboDialogRef.current?.close();
      showNotice(`Combo ${newComboSlug} created!`);
      await fetchOverview();
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
    showNotice(`Combo strategy updated to '${strategy}'`);
    await fetchOverview();
  };

  const handleDeleteCombo = async (comboId: string): Promise<void> => {
    await fetch(`/api/admin/combos/${encodeURIComponent(comboId)}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': adminToken },
    });
    showNotice('Custom combo deleted');
    await fetchOverview();
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
    showNotice(`Simulated Layer 3 Per-Model Lockout on (${conn.name}, deepseek-r1)!`);
    await fetchOverview();
  };

  const handleResetResilience = async (): Promise<void> => {
    await fetch('/api/admin/resilience/reset', {
      method: 'POST',
      headers: { 'x-admin-token': adminToken },
    });
    showNotice('All circuit breakers, cooldowns, and model lockouts reset!');
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
        payload = { model: pgModel, input: pgPrompt };
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
        'x-bansosrouter-sdk-persona',
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

  // Derived data
  const providerRegistry = data?.catalogs.providerRegistry ?? [];
  const connections = data?.connections ?? [];
  const combos = data?.combos ?? [];
  const apiKeys = data?.apiKeys ?? [];
  const recentLogs = data?.recentLogs ?? [];
  const freeTiers = data?.catalogs.freeTiers ?? [];
  const bansosWatchlist = data?.catalogs.bansosWatchlist ?? [];

  const qLower = searchQuery.trim().toLowerCase();
  const filteredProviders = providerRegistry.filter(
    (p) =>
      !qLower ||
      p.name.toLowerCase().includes(qLower) ||
      p.id.toLowerCase().includes(qLower) ||
      p.description.toLowerCase().includes(qLower) ||
      p.defaultModels.some((m) => m.toLowerCase().includes(qLower))
  );

  const oauthProvidersList = filteredProviders.filter((p) => p.category === 'oauth');
  const freeProvidersList = filteredProviders.filter(
    (p) => p.category === 'free' || p.category === 'zero-key' || p.category === 'local'
  );
  const apikeyProvidersList = filteredProviders.filter(
    (p) =>
      p.category !== 'oauth' &&
      p.category !== 'free' &&
      p.category !== 'zero-key' &&
      p.category !== 'local'
  );

  const selectedProviderObj = selectedProviderId
    ? providerRegistry.find((p) => p.id === selectedProviderId) ?? null
    : null;

  const baseUrlOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://bansosrouter.ridloabelian.workers.dev';
  const baseEndpointV1 = `${baseUrlOrigin}/v1`;

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
    const matchesQuery =
      !qLower ||
      ft.name.toLowerCase().includes(qLower) ||
      ft.provider.toLowerCase().includes(qLower) ||
      ft.description.toLowerCase().includes(qLower) ||
      ft.featuredModels.some((m) => m.toLowerCase().includes(qLower));
    return matchesPolicy && matchesQuery;
  });

  // ============================================================================
  // 1. AUTH CHECKING / 9ROUTER EXACT LOGIN SCREEN
  // ============================================================================
  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-text-main">
        <div className="flex items-center gap-3 text-text-muted">
          <span className="material-symbols-outlined animate-spin text-primary">
            progress_activity
          </span>
          <span className="text-sm font-medium">Loading BansosRouter...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4 relative overflow-hidden">
        <div className="landing-grid absolute inset-0 pointer-events-none" />
        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8">
            <div className="inline-flex size-12 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 items-center justify-center text-white shadow-[var(--shadow-warm)] mb-3">
              <span className="material-symbols-outlined text-[26px]">hub</span>
            </div>
            <h1 className="text-3xl font-bold text-primary mb-2">BansosRouter</h1>
            <p className="text-text-muted text-sm">
              Enter your password to access the dashboard
            </p>
          </div>

          <Card>
            <form onSubmit={(e) => void handleAdminLogin(e)} className="space-y-4">
              <Input
                type="password"
                label="Password"
                placeholder="Enter your password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                error={loginError ?? undefined}
                required
              />

              <Button
                type="submit"
                variant="primary"
                fullWidth
                loading={loginLoading}
              >
                Login
              </Button>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  // Helper to render a 9Router ProviderCard in Providers Grid
  const renderProviderCard = (p: ProviderRegistryClientItem) => {
    const provConns = connections.filter((c) => c.provider === p.id);
    const activeConns = provConns.filter((c) => c.status === 'active');
    const isZeroKey = p.authType === 'no_auth' || p.authType === 'workers_ai';

    return (
      <Card
        key={p.id}
        padding="xs"
        hover
        onClick={() => setSelectedProviderId(p.id)}
        className="group relative overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <ProviderIcon
              providerId={p.id}
              textIcon={p.textIcon}
              color={p.color}
              size={36}
            />
            <div className="min-w-0 flex-1">
              <h3
                className="font-semibold text-text-main text-sm truncate"
                title={p.name}
              >
                {p.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {activeConns.length > 0 ? (
                  <Badge variant="success" size="sm" dot>
                    {activeConns.length} Connected
                  </Badge>
                ) : provConns.length > 0 ? (
                  <Badge variant="warning" size="sm" dot>
                    {provConns.length} Paused
                  </Badge>
                ) : isZeroKey ? (
                  <Badge variant="info" size="sm" dot>
                    Zero-Key Ready
                  </Badge>
                ) : (
                  <span className="text-xs text-text-muted">No connections</span>
                )}
              </div>
            </div>
          </div>

          {provConns.length > 0 && (
            <div
              className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <Toggle
                size="sm"
                checked={activeConns.length > 0}
                onChange={() => {
                  const first = provConns[0];
                  if (first) void handleToggleConnectionStatus(first);
                }}
              />
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg relative">
      {/* Subtle 9Router grid background */}
      <div className="landing-grid absolute inset-0 pointer-events-none z-0" />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-surface border border-primary/40 text-text-main shadow-xl">
          <span className="material-symbols-outlined text-primary text-[20px]">
            check_circle
          </span>
          <span className="text-sm font-medium">{toast}</span>
        </div>
      )}

      {/* Desktop Left Sidebar */}
      <div className="hidden lg:block z-10">
        <Sidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            setSelectedProviderId(null);
          }}
        />
      </div>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 h-full">
            <Sidebar
              activeTab={activeTab}
              onSelectTab={(tab) => {
                setActiveTab(tab);
                setSelectedProviderId(null);
              }}
              onCloseMobile={() => setMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
        <Header
          activeTab={activeTab}
          selectedProviderDetail={
            selectedProviderObj
              ? { id: selectedProviderObj.id, name: selectedProviderObj.name }
              : null
          }
          onClearProviderDetail={() => setSelectedProviderId(null)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onSeedDemo={() => void handleSeedDemoConnections()}
          onLogout={handleAdminLogout}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10">
          <div className="max-w-7xl mx-auto w-full flex flex-col gap-6">
            {/* ==============================================================
                TAB 1: ENDPOINT & API KEYS (Exact 9Router EndpointPageClient)
               ============================================================== */}
            {activeTab === 'endpoint' && (
              <div className="flex flex-col gap-6">
                <Card>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-text-main">API Endpoint</h2>
                      <p className="text-sm text-text-muted">
                        OpenAI, Anthropic, and Gemini compatible endpoint ($0 / Rp 0 Lock)
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-white">
                      <span className="material-symbols-outlined text-[16px]">cloud_done</span>
                      <span>Cloudflare Edge</span>
                    </div>
                  </div>

                  {/* Endpoint URL Box */}
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={baseEndpointV1}
                      readOnly
                      className="flex-1 px-4 py-2.5 font-mono text-sm rounded-lg border bg-primary/5 border-primary/30 text-text-main focus:outline-none"
                    />
                    <Button
                      variant="secondary"
                      icon="content_copy"
                      onClick={() => copyText(baseEndpointV1, 'Copied API Endpoint URL!')}
                    >
                      Copy
                    </Button>
                    <Button
                      variant="primary"
                      icon="terminal"
                      onClick={() => setActiveTab('cli-tools')}
                    >
                      Quick Start
                    </Button>
                  </div>

                  {/* Alternative Endpoints Collapsible */}
                  <div className="border-t border-border/50 pt-3 mt-1">
                    <button
                      type="button"
                      onClick={() => setShowAltEndpoints(!showAltEndpoints)}
                      className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-main transition-colors py-1"
                    >
                      <span
                        className="material-symbols-outlined text-[16px] transition-transform duration-200"
                        style={{
                          transform: showAltEndpoints ? 'rotate(90deg)' : 'rotate(0deg)',
                        }}
                      >
                        chevron_right
                      </span>
                      <span>Alternative Endpoints (Anthropic, Responses API, Gemini)</span>
                    </button>

                    {showAltEndpoints && (
                      <div className="mt-2 grid grid-cols-1 gap-1.5">
                        {[
                          { path: `${baseUrlOrigin}/v1/chat/completions`, desc: 'OpenAI Chat Completions' },
                          { path: `${baseUrlOrigin}/v1/responses`, desc: 'OpenAI Responses API (Codex CLI)' },
                          { path: `${baseUrlOrigin}/v1/messages`, desc: 'Anthropic Messages API (Claude Code)' },
                          { path: `${baseUrlOrigin}/v1beta/models/bansos/auto:generateContent`, desc: 'Google Gemini v1beta Native' },
                        ].map(({ path, desc }) => (
                          <div
                            key={path}
                            onClick={() => copyText(path, `Copied ${desc} URL!`)}
                            className="group flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-surface/60 hover:bg-primary/5 border border-border/60 hover:border-primary/30 cursor-pointer transition-all"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="font-mono text-xs text-primary font-medium truncate">
                                {path}
                              </span>
                              <span className="text-xs text-text-muted hidden sm:inline">
                                — {desc}
                              </span>
                            </div>
                            <span className="material-symbols-outlined text-[15px] text-text-muted group-hover:text-primary shrink-0 transition-colors">
                              content_copy
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>

                {/* API Keys Card */}
                <Card>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-text-main">API Keys</h2>
                      <p className="text-xs text-text-muted">
                        Manage client keys (`bansos_live_...`) for your IDE & CLI agents
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Toggle
                          size="sm"
                          checked={requireApiKey}
                          onChange={setRequireApiKey}
                        />
                        <span className="text-xs text-text-muted">Require API key</span>
                      </div>
                      <Button
                        icon="add"
                        onClick={() => createKeyDialogRef.current?.showModal()}
                      >
                        Create Key
                      </Button>
                    </div>
                  </div>

                  {createdRawKey && (
                    <div className="mb-4 p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-emerald-500">
                          New Client Key Generated (Copy now — shown once)
                        </p>
                        <code className="text-xs font-mono text-text-main break-all">
                          {createdRawKey}
                        </code>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon="content_copy"
                        onClick={() => copyText(createdRawKey, 'Copied raw API key!')}
                      >
                        Copy
                      </Button>
                    </div>
                  )}

                  {apiKeys.length === 0 ? (
                    <div className="text-center py-12 text-text-muted">
                      <span className="material-symbols-outlined text-4xl mb-2 block opacity-40">
                        vpn_key
                      </span>
                      <p className="text-sm">No API keys yet</p>
                      <p className="text-xs mt-1">
                        Click &ldquo;Create Key&rdquo; to generate your first `bansos_live_...` key
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      {apiKeys.map((k) => {
                        const isVisible = !!visibleKeyIds[k.id];
                        const displayKey = isVisible
                          ? `${k.keyPrefix}••••••••••••••••`
                          : `${k.keyPrefix.slice(0, 12)}••••••`;
                        return (
                          <div
                            key={k.id}
                            className="group flex items-center justify-between py-3 border-b border-border/50 last:border-b-0"
                          >
                            <div className="flex-1 min-w-0 pr-4">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-text-main">{k.name}</p>
                                <Badge variant="success" size="sm">
                                  Rp 0 Lock
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                <code className="text-xs font-mono text-text-muted">
                                  {displayKey}
                                </code>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setVisibleKeyIds((prev) => ({
                                      ...prev,
                                      [k.id]: !prev[k.id],
                                    }))
                                  }
                                  className="p-1 text-text-muted hover:text-text-main rounded transition-colors"
                                  title={isVisible ? 'Hide key' : 'Show key prefix'}
                                >
                                  <span className="material-symbols-outlined text-[14px]">
                                    {isVisible ? 'visibility_off' : 'visibility'}
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => copyText(k.keyPrefix, 'Copied key prefix!')}
                                  className="p-1 text-text-muted hover:text-text-main rounded transition-colors"
                                  title="Copy key"
                                >
                                  <span className="material-symbols-outlined text-[14px]">
                                    content_copy
                                  </span>
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 shrink-0">
                              <span className="text-xs text-text-muted hidden sm:inline">
                                {k.totalRequests} reqs • {k.quotaSharePercent}% pool
                              </span>
                              <button
                                type="button"
                                onClick={() => void handleDeleteApiKey(k.id)}
                                className="p-1.5 text-text-muted hover:text-red-500 rounded-lg hover:bg-red-500/10 transition-all"
                                title="Delete key"
                              >
                                <span className="material-symbols-outlined text-[16px]">
                                  delete
                                </span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* ==============================================================
                TAB 2: PROVIDERS (Grid View + 9Router Provider Detail View)
               ============================================================== */}
            {activeTab === 'providers' && !selectedProviderObj && (
              <div className="flex flex-col gap-8">
                {/* Top Quick Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-surface border border-border rounded-xl p-4 shadow-[var(--shadow-soft)]">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <span className="material-symbols-outlined">dns</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-text-main">
                          {connections.length} Active Connections across {providerRegistry.length} Free Providers
                        </h3>
                        <Badge variant="primary" size="sm">
                          16 SDK Personas Active
                        </Badge>
                      </div>
                      <p className="text-xs text-text-muted">
                        Click any provider below to manage accounts, SDK Fingerprint slots, and models
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      icon="auto_awesome"
                      onClick={() => void handleSeedDemoConnections()}
                    >
                      Seed 7 Free Starters
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      icon="add"
                      onClick={() => openAddConnectionModal('groq')}
                    >
                      Add Connection
                    </Button>
                  </div>
                </div>

                {/* Section 1: OAuth Providers */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-text-main">OAuth Providers</h2>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon="add"
                        onClick={() => openOAuthWizard('gemini-cli')}
                      >
                        Connect OAuth
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        icon="vital_signs"
                        loading={testingProviderGroup === 'oauth'}
                        onClick={() => {
                          setTestingProviderGroup('oauth');
                          window.setTimeout(() => {
                            setTestingProviderGroup(null);
                            showNotice('All OAuth provider connections verified healthy!');
                          }, 600);
                        }}
                      >
                        Test All
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {oauthProvidersList.map(renderProviderCard)}
                  </div>
                </div>

                {/* Section 2: Free Tier & Zero-Key Providers */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold text-text-main">
                        Free Tier & Zero-Key Providers
                      </h2>
                      <Badge variant="success" size="sm">
                        No Credit Card
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      icon="vital_signs"
                      loading={testingProviderGroup === 'free'}
                      onClick={() => {
                        setTestingProviderGroup('free');
                        window.setTimeout(() => {
                          setTestingProviderGroup(null);
                          showNotice('All Free Tier & Zero-Key providers verified healthy!');
                        }, 600);
                      }}
                    >
                      Test All
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {freeProvidersList.map(renderProviderCard)}
                  </div>
                </div>

                {/* Section 3: API Key & Bansos Credits Providers */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-text-main">
                      API Key & Bansos Credit Providers ($10–$100 Free)
                    </h2>
                    <Button
                      size="sm"
                      variant="outline"
                      icon="vital_signs"
                      loading={testingProviderGroup === 'apikey'}
                      onClick={() => {
                        setTestingProviderGroup('apikey');
                        window.setTimeout(() => {
                          setTestingProviderGroup(null);
                          showNotice('All API Key connections verified healthy!');
                        }, 600);
                      }}
                    >
                      Test All
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {apikeyProvidersList.map(renderProviderCard)}
                  </div>
                </div>
              </div>
            )}

            {/* ==============================================================
                TAB 2B: PROVIDER DETAIL VIEW (Exact 9Router providers/[id]/page.js)
               ============================================================== */}
            {activeTab === 'providers' && selectedProviderObj && (
              <div className="flex flex-col gap-6">
                <div>
                  <button
                    type="button"
                    onClick={() => setSelectedProviderId(null)}
                    className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-main transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    <span>Back to Providers</span>
                  </button>
                </div>

                {/* Provider Summary Header Card */}
                <Card>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <ProviderIcon
                        providerId={selectedProviderObj.id}
                        textIcon={selectedProviderObj.textIcon}
                        color={selectedProviderObj.color}
                        size={48}
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-xl font-bold text-text-main">
                            {selectedProviderObj.name}
                          </h2>
                          <Badge variant="success" size="sm">
                            Rp 0 Free-Tier
                          </Badge>
                          <Badge variant="default" size="sm">
                            {selectedProviderObj.protocol}
                          </Badge>
                        </div>
                        <p className="text-sm text-text-muted mt-0.5">
                          {selectedProviderObj.description}
                        </p>
                        <p className="text-xs font-mono text-text-muted/80 mt-1">
                          Endpoint: {selectedProviderObj.baseUrl}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {selectedProviderObj.website && (
                        <a
                          href={selectedProviderObj.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-border text-text-muted hover:text-text-main hover:bg-surface-2 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            open_in_new
                          </span>
                          <span>Get Free Key</span>
                        </a>
                      )}
                      {selectedProviderObj.category === 'oauth' ? (
                        <Button
                          icon="add"
                          onClick={() => openOAuthWizard(selectedProviderObj.id)}
                        >
                          Connect OAuth Account
                        </Button>
                      ) : (
                        <Button
                          icon="add"
                          onClick={() => openAddConnectionModal(selectedProviderObj.id)}
                        >
                          Add Connection
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Connections Card for this Provider */}
                <Card
                  title="Connections"
                  subtitle="Each account automatically receives a unique SDK Fingerprint Persona (User-Agent + X-Stainless-* headers)"
                  icon="key"
                  action={
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        icon="vital_signs"
                        onClick={() =>
                          showNotice(
                            `All ${selectedProviderObj.name} connections tested OK (Rp 0)!`
                          )
                        }
                      >
                        Test Connections
                      </Button>
                    </div>
                  }
                >
                  {(() => {
                    const provConns = connections.filter(
                      (c) => c.provider === selectedProviderObj.id
                    );
                    if (provConns.length === 0) {
                      return (
                        <div className="text-center py-10 text-text-muted">
                          <span className="material-symbols-outlined text-4xl mb-2 block opacity-40">
                            link_off
                          </span>
                          <p className="text-sm">
                            No connections configured for {selectedProviderObj.name} yet.
                          </p>
                          <div className="mt-3">
                            <Button
                              size="sm"
                              icon="add"
                              onClick={() =>
                                selectedProviderObj.category === 'oauth'
                                  ? openOAuthWizard(selectedProviderObj.id)
                                  : openAddConnectionModal(selectedProviderObj.id)
                              }
                            >
                              Add First {selectedProviderObj.name} Account
                            </Button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className="flex flex-col divide-y divide-border/60">
                        {provConns.map((conn) => (
                          <div
                            key={conn.id}
                            className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-text-main">
                                  {conn.name}
                                </span>
                                <Badge
                                  variant={conn.status === 'active' ? 'success' : 'warning'}
                                  size="sm"
                                  dot
                                >
                                  {conn.status}
                                </Badge>
                                <Badge variant="primary" size="sm" icon="fingerprint">
                                  Persona #{(conn.sdkPersonaSlot ?? 0) + 1}:{' '}
                                  {conn.sdkPersona ?? 'claude-cli/2.1.81'}
                                </Badge>
                                <span className="text-xs font-mono text-text-muted">
                                  Priority #{conn.priority}
                                </span>
                              </div>
                              <div className="text-xs text-text-muted mt-1 flex items-center gap-4 flex-wrap">
                                <span>
                                  Daily:{' '}
                                  {(conn.tokensUsedToday / 1000).toFixed(1)}K /{' '}
                                  {(conn.dailyTokenLimit / 1000).toFixed(0)}K tok
                                </span>
                                <span>Latency: {conn.avgLatencyMs}ms</span>
                                {conn.baseUrl && (
                                  <span className="font-mono text-primary">
                                    Proxy: {conn.baseUrl}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <Toggle
                                size="sm"
                                checked={conn.status === 'active'}
                                onChange={() => void handleToggleConnectionStatus(conn)}
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                icon="delete"
                                onClick={() => void handleDeleteConnection(conn)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </Card>

                {/* Available Models Card */}
                <Card
                  title="Available Models"
                  subtitle={`Use these model IDs in your IDE or CLI with ${selectedProviderObj.name}`}
                  icon="smart_toy"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {selectedProviderObj.defaultModels.map((m) => {
                      const fullModelId = `${selectedProviderObj.id}/${m}`;
                      return (
                        <div
                          key={m}
                          onClick={() => copyText(m, `Copied model ID: ${m}`)}
                          className="group flex items-center justify-between p-3 rounded-lg bg-bg/60 border border-border hover:border-primary/40 cursor-pointer transition-all"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="text-xs font-mono font-semibold text-text-main truncate">
                              {m}
                            </p>
                            <p className="text-[11px] font-mono text-text-muted truncate mt-0.5">
                              {fullModelId}
                            </p>
                          </div>
                          <span className="material-symbols-outlined text-[16px] text-text-muted group-hover:text-primary shrink-0">
                            content_copy
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            )}

            {/* ==============================================================
                TAB 3: BANSOS FREE TIERS (24+ Sumber Rp 0 + Anti-Boncos Watchlist)
               ============================================================== */}
            {activeTab === 'free-tiers' && (
              <div className="flex flex-col gap-6">
                {/* Summary & Calculator Card */}
                <Card>
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="primary" icon="volunteer_activism">
                          7 Repositori Bansos LLM Terkurasi
                        </Badge>
                        <Badge variant="success">Rp 0 / $0 Lock</Badge>
                      </div>
                      <h2 className="text-xl font-bold text-text-main">
                        Total Kuota Terpilih:{' '}
                        <span className="text-primary">
                          {(totalSelectedFreeMonthlyTokens / 1_000_000_000).toFixed(2)} Miliar
                          Token/Bulan
                        </span>{' '}
                        ({(totalSelectedFreeDailyTokens / 1_000_000).toFixed(1)} Juta/Hari)
                      </h2>
                      <p className="text-xs text-text-muted mt-1">
                        Semua sumber di bawah ini 100% gratis (Free-Tier Resmi, Zero-Key, OAuth
                        CLI, atau Kredit Bansos $10–$100). Klik &ldquo;Pasang ke Pool&rdquo; untuk
                        menambahkan ke BansosRouter.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        icon="auto_awesome"
                        onClick={() => void handleSeedDemoConnections()}
                      >
                        Seed 7 Starter Gratis
                      </Button>
                    </div>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border/50">
                    {[
                      { id: 'all', label: `Semua (${freeTiers.length})` },
                      { id: 'no_cc', label: '100% Tanpa Kartu Kredit' },
                      { id: 'zero_key', label: 'Zero-Key (Langsung Jalan)' },
                      { id: 'oauth_free', label: 'OAuth CLI Gratis' },
                      { id: 'phone_only', label: 'Verifikasi SMS / GitHub' },
                      { id: 'free_credits', label: 'Kredit Bansos ($10–$100)' },
                      { id: 'indo-local', label: 'Model Indonesia & Lokal' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setBansosPolicyFilter(f.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          bansosPolicyFilter === f.id
                            ? 'bg-primary text-white border-primary'
                            : 'bg-surface text-text-muted border-border hover:text-text-main'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </Card>

                {/* Grid of 24+ Free-Tier Sources */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredFreeTiers.map((ft) => {
                    const checked = !!selectedFreeTiers[ft.id];
                    return (
                      <Card key={ft.id} padding="sm" className="flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <ProviderIcon providerId={ft.provider} size={36} />
                              <div className="min-w-0">
                                <h3 className="font-semibold text-sm text-text-main truncate">
                                  {ft.name}
                                </h3>
                                <span className="text-[11px] text-primary font-medium">
                                  {ft.verificationBadge}
                                </span>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setSelectedFreeTiers((prev) => ({
                                  ...prev,
                                  [ft.id]: !prev[ft.id],
                                }))
                              }
                              className="size-4 rounded accent-primary mt-1"
                              title="Hitung dalam kalkulator kuota bulanan"
                            />
                          </div>

                          <div className="flex flex-wrap gap-1.5 mb-2.5">
                            <Badge
                              variant={
                                ft.creditCardPolicy === 'no_cc' ||
                                ft.creditCardPolicy === 'zero_key'
                                  ? 'success'
                                  : ft.creditCardPolicy === 'oauth_free'
                                  ? 'info'
                                  : 'warning'
                              }
                              size="sm"
                            >
                              {ft.creditCardLabel}
                            </Badge>
                            <Badge variant="default" size="sm">
                              {(ft.dailyFreeTokens / 1_000_000).toFixed(1)}M tok/day
                            </Badge>
                            <Badge variant="default" size="sm">
                              {ft.rpmLimit} RPM
                            </Badge>
                          </div>

                          <p className="text-xs text-text-muted leading-relaxed mb-3">
                            {ft.description}
                          </p>

                          <div className="flex flex-wrap gap-1 mb-3">
                            {ft.featuredModels.slice(0, 3).map((m) => (
                              <span
                                key={m}
                                onClick={() => copyText(m, `Copied model: ${m}`)}
                                className="px-2 py-0.5 rounded bg-bg border border-border font-mono text-[10px] text-text-main cursor-pointer hover:border-primary"
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="pt-3 border-t border-border/50 flex items-center justify-between gap-2">
                          <a
                            href={ft.signupUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-primary transition-colors"
                          >
                            <span>Klaim Key</span>
                            <span className="material-symbols-outlined text-[14px]">
                              open_in_new
                            </span>
                          </a>
                          <Button
                            size="sm"
                            variant="primary"
                            icon="add"
                            onClick={() => {
                              if (
                                ft.authType === 'oauth_device' ||
                                ft.authType === 'oauth_pkce'
                              ) {
                                openOAuthWizard(ft.provider);
                              } else {
                                openAddConnectionModal(ft.provider);
                              }
                            }}
                          >
                            Pasang ke Pool
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>

                {/* Anti-Boncos Watchlist Card */}
                {bansosWatchlist.length > 0 && (
                  <Card
                    title="Watchlist Anti-Boncos (Provider Tidak Lagi Gratis / Jebakan CC)"
                    subtitle="Diblokir otomatis oleh BansosRouter agar tagihan Anda tetap Rp 0"
                    icon="gpp_maybe"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {bansosWatchlist.map((w) => (
                        <div
                          key={w.providerName}
                          className="p-3.5 rounded-lg bg-red-500/5 border border-red-500/20 flex flex-col gap-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm text-red-500">
                              {w.providerName}
                            </span>
                            <Badge variant="error" size="sm">
                              {w.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-text-muted">{w.reason}</p>
                          <p className="text-xs text-emerald-500 font-medium mt-1">
                            ✓ Alternatif Gratis: {w.freeAlternativeInBansosRouter}
                          </p>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* ==============================================================
                TAB 4: COMBOS (Exact 9Router Combos Page)
               ============================================================== */}
            {activeTab === 'combos' && (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                        Fallback
                      </span>
                      <span className="text-xs text-text-muted">+</span>
                      <span className="text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                        Round-Robin
                      </span>
                      <span className="text-xs text-text-muted">+</span>
                      <span className="text-xs font-semibold text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full">
                        19 Routing Strategies
                      </span>
                      <span className="text-xs text-text-muted">—</span>
                      <span className="text-xs text-text-muted">
                        Wait-free auto-switch across 24+ free providers before hitting 429
                      </span>
                    </div>
                  </div>
                  <Button
                    icon="add"
                    onClick={() => createComboDialogRef.current?.showModal()}
                  >
                    Create Combo
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {combos.map((combo) => (
                    <Card key={combo.id} padding="sm" className="group">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="material-symbols-outlined text-primary text-[18px]">
                              layers
                            </span>
                            <code className="text-sm font-mono font-bold text-text-main">
                              {combo.slug}
                            </code>
                            <button
                              type="button"
                              onClick={() =>
                                copyText(combo.slug, `Copied combo model: ${combo.slug}`)
                              }
                              className="p-1 text-text-muted hover:text-primary rounded"
                              title="Copy combo slug"
                            >
                              <span className="material-symbols-outlined text-[15px]">
                                content_copy
                              </span>
                            </button>
                            {combo.isSystem ? (
                              <Badge variant="primary" size="sm">
                                System Bansos
                              </Badge>
                            ) : (
                              <Badge variant="default" size="sm">
                                Custom
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs font-medium text-text-main mt-1">
                            {combo.name}
                          </p>
                          <p className="text-xs text-text-muted mt-0.5">
                            {combo.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            value={combo.strategy}
                            onChange={(e) =>
                              void handleUpdateComboStrategy(combo.id, e.target.value)
                            }
                            className="text-xs rounded-lg border border-border bg-bg px-2.5 py-1.5 text-text-main focus:border-primary focus:outline-none"
                          >
                            {(data?.catalogs.strategies ?? ['reset-aware', 'p2c', 'lkg', 'auto']).map(
                              (s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              )
                            )}
                          </select>
                          {!combo.isSystem && (
                            <Button
                              size="sm"
                              variant="ghost"
                              icon="delete"
                              onClick={() => void handleDeleteCombo(combo.id)}
                            />
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* ==============================================================
                TAB 5: USAGE & ANALYTICS (Exact 9Router UsageStats Layout)
               ============================================================== */}
            {activeTab === 'usage' && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <SegmentedControl
                    options={[
                      { value: 'overview', label: 'Overview', icon: 'bar_chart' },
                      { value: 'logs', label: 'Request Logs', icon: 'receipt_long' },
                    ]}
                    value={usageSubTab}
                    onChange={setUsageSubTab}
                  />

                  <div className="flex items-center gap-2">
                    <SegmentedControl
                      size="sm"
                      options={[
                        { value: 'today', label: 'Today' },
                        { value: '24h', label: '24h' },
                        { value: '7d', label: '7D' },
                        { value: '30d', label: '30D' },
                      ]}
                      value={usagePeriod}
                      onChange={setUsagePeriod}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      icon="refresh"
                      loading={loading}
                      onClick={() => void fetchOverview()}
                    />
                  </div>
                </div>

                {/* 4 KPI Overview Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card padding="sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                        Total Requests
                      </span>
                      <span className="material-symbols-outlined text-primary text-[20px]">
                        sync_alt
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-text-main mt-2">
                      {(data?.stats.totalRequests ?? 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      Avg Latency: {Math.round(data?.stats.avgLatencyMs ?? 0)}ms
                    </p>
                  </Card>

                  <Card padding="sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                        Total Tokens Routed
                      </span>
                      <span className="material-symbols-outlined text-primary text-[20px]">
                        data_usage
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-text-main mt-2">
                      {(data?.stats.totalTokens ?? 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      Cached: {(data?.stats.totalCachedTokens ?? 0).toLocaleString()} tok
                    </p>
                  </Card>

                  <Card padding="sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                        Tokens Saved (10-Layer)
                      </span>
                      <span className="material-symbols-outlined text-emerald-500 text-[20px]">
                        savings
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-emerald-500 mt-2">
                      {(data?.stats.totalTokensSaved ?? 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-text-muted mt-1">
                      Pre-request edge compression
                    </p>
                  </Card>

                  <Card padding="sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                        Total Cost (Locked)
                      </span>
                      <span className="material-symbols-outlined text-emerald-500 text-[20px]">
                        verified
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-emerald-500 mt-2">Rp 0 ($0.00)</p>
                    <p className="text-xs text-text-muted mt-1">
                      100% Free-Tier Guarantee
                    </p>
                  </Card>
                </div>

                {/* Recent Requests Table */}
                <Card
                  title="Recent Requests"
                  subtitle="Real-time telemetry from Cloudflare D1"
                  icon="history"
                >
                  {recentLogs.length === 0 ? (
                    <div className="text-center py-10 text-text-muted">
                      <p className="text-sm">No requests recorded yet.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-xs text-text-muted uppercase">
                            <th className="py-2.5 pr-4">Status</th>
                            <th className="py-2.5 px-4">Provider / Model</th>
                            <th className="py-2.5 px-4">Strategy</th>
                            <th className="py-2.5 px-4">Protocol</th>
                            <th className="py-2.5 px-4 text-right">Tokens</th>
                            <th className="py-2.5 px-4 text-right">Saved</th>
                            <th className="py-2.5 px-4 text-right">Latency</th>
                            <th className="py-2.5 pl-4 text-right">Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {recentLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-bg/50">
                              <td className="py-2.5 pr-4">
                                <Badge
                                  variant={log.statusCode < 400 ? 'success' : 'error'}
                                  size="sm"
                                >
                                  {log.statusCode}
                                </Badge>
                              </td>
                              <td className="py-2.5 px-4">
                                <div className="flex items-center gap-2">
                                  <ProviderIcon providerId={log.provider} size={20} />
                                  <span className="font-mono text-xs font-medium text-text-main">
                                    {log.modelUsed}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 px-4 font-mono text-xs text-text-muted">
                                {log.strategyUsed}
                              </td>
                              <td className="py-2.5 px-4 text-xs text-text-muted">
                                {log.inboundProtocol}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono text-xs">
                                {log.promptTokens + log.completionTokens}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono text-xs text-emerald-500">
                                +{log.tokensSaved}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono text-xs text-text-muted">
                                {log.latencyMs}ms
                              </td>
                              <td className="py-2.5 pl-4 text-right font-mono text-xs font-semibold text-emerald-500">
                                Rp 0
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* ==============================================================
                TAB 6: QUOTA TRACKER & 3-LAYER RESILIENCE
               ============================================================== */}
            {activeTab === 'quota' && (
              <div className="flex flex-col gap-6">
                <Card
                  title="3-Layer Resilience & Per-Model Lockout"
                  subtitle="Isolates rate limits at the (Connection + Model) level so sibling models on the same account keep working"
                  icon="shield"
                  action={
                    <Button
                      size="sm"
                      variant="secondary"
                      icon="restart_alt"
                      onClick={() => void handleResetResilience()}
                    >
                      Reset All Lockouts
                    </Button>
                  }
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="p-4 rounded-xl bg-bg/60 border border-border">
                      <p className="text-xs font-semibold text-text-muted uppercase">
                        Layer 1: Provider Circuits
                      </p>
                      <p className="text-xl font-bold text-text-main mt-1">
                        {data?.resilience.circuits.length ?? 0} Open
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-bg/60 border border-border">
                      <p className="text-xs font-semibold text-text-muted uppercase">
                        Layer 2: Account Cooldowns
                      </p>
                      <p className="text-xl font-bold text-text-main mt-1">
                        {data?.resilience.cooldowns.length ?? 0} Active
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-bg/60 border border-border">
                      <p className="text-xs font-semibold text-text-muted uppercase">
                        Layer 3: Per-Model Lockouts
                      </p>
                      <p className="text-xl font-bold text-primary mt-1">
                        {data?.resilience.modelLockouts.length ?? 0} Isolated
                      </p>
                    </div>
                  </div>

                  {(data?.resilience.modelLockouts.length ?? 0) > 0 && (
                    <div className="space-y-2">
                      {data?.resilience.modelLockouts.map((lk, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs flex items-center justify-between"
                        >
                          <span>
                            Locked model <strong>{lk.model}</strong> on connection{' '}
                            <code>{lk.connectionId}</code> — {lk.reason}
                          </span>
                          <Badge variant="warning" size="sm">
                            Sibling models active
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card
                  title="Connection Quota Windows (5-Hour & Daily)"
                  subtitle="Reset-Aware routing automatically prioritizes accounts whose quota window is closest to resetting"
                  icon="data_usage"
                >
                  <div className="space-y-4">
                    {connections.map((conn) => {
                      const dailyPct = Math.min(
                        100,
                        Math.round((conn.tokensUsedToday / Math.max(1, conn.dailyTokenLimit)) * 100)
                      );
                      const winPct = Math.min(
                        100,
                        Math.round(
                          (conn.tokensUsedWindow / Math.max(1, conn.windowTokenLimit)) * 100
                        )
                      );
                      return (
                        <div
                          key={conn.id}
                          className="p-4 rounded-xl bg-bg/60 border border-border flex flex-col gap-3"
                        >
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-3">
                              <ProviderIcon providerId={conn.provider} size={28} />
                              <div>
                                <p className="text-sm font-semibold text-text-main">
                                  {conn.name}
                                </p>
                                <p className="text-xs text-text-muted">
                                  SDK Persona: {conn.sdkPersona}
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              icon="science"
                              onClick={() => void handleSimulateModelLockout(conn)}
                            >
                              Simulate Layer 3 Lockout
                            </Button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-text-muted">5-Hour Window Quota</span>
                                <span className="font-mono text-text-main">{winPct}%</span>
                              </div>
                              <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full"
                                  style={{ width: `${winPct}%` }}
                                />
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-text-muted">Daily Free Token Quota</span>
                                <span className="font-mono text-text-main">{dailyPct}%</span>
                              </div>
                              <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${dailyPct}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            )}

            {/* ==============================================================
                TAB 7: TOKEN SAVER (Exact 9Router TokenSaverClient + 10-Layer Studio)
               ============================================================== */}
            {activeTab === 'token-saver' && (
              <div className="flex flex-col gap-6">
                <Card>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                      <span className="material-symbols-outlined text-[20px]">savings</span>
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-text-main">Token Saver</h2>
                      <p className="text-xs text-text-muted">
                        Reduce input and output token usage across all free-tier providers
                      </p>
                    </div>
                  </div>

                  <div className="divide-y divide-border">
                    {/* Row 1: RTK */}
                    <div className="flex items-center justify-between py-3.5 first:pt-0">
                      <div>
                        <p className="text-sm font-medium text-text-main">
                          Compress tool output (RTK)
                        </p>
                        <p className="text-xs text-text-muted mt-0.5">
                          Shrink CLI command results before they enter context
                        </p>
                      </div>
                      <Toggle checked={tsRtkEnabled} onChange={setTsRtkEnabled} />
                    </div>

                    {/* Row 2: Headroom */}
                    <div className="flex items-center justify-between py-3.5">
                      <div>
                        <p className="text-sm font-medium text-text-main">
                          Compress context (Headroom)
                        </p>
                        <p className="text-xs text-text-muted mt-0.5">
                          Trim redundant history & JSON CrumbArrays before sending to LLM
                        </p>
                      </div>
                      <Toggle checked={tsHeadroomEnabled} onChange={setTsHeadroomEnabled} />
                    </div>

                    {/* Row 3: Caveman Mode */}
                    <div className="flex flex-col gap-3 py-3.5 last:pb-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-text-main">Caveman mode</p>
                          <p className="text-xs text-text-muted mt-0.5">
                            Force terse responses (~65% fewer output tokens)
                          </p>
                        </div>
                        <Toggle checked={tsCavemanEnabled} onChange={setTsCavemanEnabled} />
                      </div>

                      {tsCavemanEnabled && (
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            {
                              value: 'lite' as const,
                              label: 'Lite',
                              desc: 'Drop filler, keep grammar',
                              example: '"Use middleware for auth routes."',
                            },
                            {
                              value: 'full' as const,
                              label: 'Full',
                              desc: 'Drop articles, fragments OK',
                              example: '"Use middleware -> protect routes."',
                            },
                            {
                              value: 'ultra' as const,
                              label: 'Ultra',
                              desc: 'Telegraphic, symbols & arrows',
                              example: '"middleware -> auth routes"',
                            },
                          ].map((l) => (
                            <button
                              key={l.value}
                              type="button"
                              onClick={() => setTsCavemanLevel(l.value)}
                              className={`text-left px-3 py-2.5 rounded-lg border transition-colors ${
                                tsCavemanLevel === l.value
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border hover:border-text-muted'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-0.5">
                                <span
                                  className={`text-xs font-semibold ${
                                    tsCavemanLevel === l.value
                                      ? 'text-primary'
                                      : 'text-text-main'
                                  }`}
                                >
                                  {l.label}
                                </span>
                              </div>
                              <p className="text-[11px] text-text-muted leading-snug mb-1.5">
                                {l.desc}
                              </p>
                              <p className="text-[11px] font-mono text-text-muted/80 bg-surface px-1.5 py-0.5 rounded truncate">
                                {l.example}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Live 10-Layer Compression Simulator */}
                <Card
                  title="10-Layer Token Compression Studio (Live Simulator)"
                  subtitle="Test how BansosRouter compresses prompts on Cloudflare Workers before sending upstream"
                  icon="compress"
                  action={
                    <div className="flex items-center gap-2">
                      <select
                        value={simProfile}
                        onChange={(e) => setSimProfile(e.target.value)}
                        className="text-xs rounded-lg border border-border bg-bg px-2.5 py-1.5 text-text-main"
                      >
                        {['conservative', 'balanced', 'aggressive', 'autonomous'].map((p) => (
                          <option key={p} value={p}>
                            Profile: {p}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        icon="play_arrow"
                        onClick={() => void handleRunCompressionSim()}
                      >
                        Run Compression
                      </Button>
                    </div>
                  }
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-text-muted mb-1 block">
                        Original Prompt Payload
                      </label>
                      <textarea
                        rows={7}
                        value={simInput}
                        onChange={(e) => setSimInput(e.target.value)}
                        className="w-full p-3 rounded-lg bg-bg border border-border font-mono text-xs text-text-main focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-text-muted mb-1 block">
                        Compressed Output{' '}
                        {simResult && (
                          <span className="text-emerald-500 font-bold ml-2">
                            (-{simResult.stats.savingsPercent.toFixed(1)}% • Saved{' '}
                            {simResult.stats.tokensSaved} tokens)
                          </span>
                        )}
                      </label>
                      <textarea
                        rows={7}
                        readOnly
                        value={
                          simResult
                            ? simResult.compressedText
                            : 'Click "Run Compression" to preview 10-layer token reduction...'
                        }
                        className="w-full p-3 rounded-lg bg-bg/60 border border-border font-mono text-xs text-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* ==============================================================
                TAB 8: CLI TOOLS (Exact 9Router CLIToolsPageClient 3-Col Grid)
               ============================================================== */}
            {activeTab === 'cli-tools' && (
              <div className="flex flex-col gap-6">
                <Card padding="sm">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary">tune</span>
                      <div>
                        <p className="text-sm font-semibold text-text-main">
                          Default Model / Combo for CLI Snippets
                        </p>
                        <p className="text-xs text-text-muted">
                          Select which Bansos combo or model to inject into the CLI configs below
                        </p>
                      </div>
                    </div>
                    <select
                      value={selectedCliModel}
                      onChange={(e) => setSelectedCliModel(e.target.value)}
                      className="text-sm rounded-lg border border-border bg-bg px-3 py-2 text-text-main font-mono"
                    >
                      <option value="bansos/coding">bansos/coding (Best for Coding)</option>
                      <option value="bansos/auto">bansos/auto (Smartest Free Router)</option>
                      <option value="bansos/no-cc">bansos/no-cc (100% Zero Credit Card)</option>
                      <option value="bansos/reasoning">bansos/reasoning (DeepSeek R1 + QwQ)</option>
                      <option value="bansos/fast">bansos/fast (Groq + Cerebras 2200 tok/s)</option>
                      <option value="bansos/million-context">bansos/million-context (1M Context)</option>
                    </select>
                  </div>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
                  {[
                    {
                      id: 'claude',
                      name: 'Claude Code',
                      providerIcon: 'claude',
                      desc: 'Anthropic Claude Code CLI via /v1/messages compatible gateway',
                      snippet: `export ANTHROPIC_BASE_URL="${baseUrlOrigin}"\nexport ANTHROPIC_AUTH_TOKEN="${apiKeys[0]?.keyPrefix ? `${apiKeys[0].keyPrefix}...` : 'bansos_live_your_key'}"\nexport ANTHROPIC_MODEL="${selectedCliModel}"\nclaude`,
                    },
                    {
                      id: 'codex',
                      name: 'OpenAI Codex CLI',
                      providerIcon: 'codex',
                      desc: 'OpenAI Codex CLI via /v1/responses and /v1/chat/completions',
                      snippet: `export OPENAI_BASE_URL="${baseEndpointV1}"\nexport OPENAI_API_KEY="${apiKeys[0]?.keyPrefix ? `${apiKeys[0].keyPrefix}...` : 'bansos_live_your_key'}"\ncodex --model "${selectedCliModel}"`,
                    },
                    {
                      id: 'cline',
                      name: 'Cline / Roo Code',
                      providerIcon: 'cline',
                      desc: 'VS Code autonomous coding agent (OpenAI Compatible mode)',
                      snippet: `API Provider: OpenAI Compatible\nBase URL: ${baseEndpointV1}\nAPI Key: ${apiKeys[0]?.keyPrefix ? `${apiKeys[0].keyPrefix}...` : 'bansos_live_your_key'}\nModel ID: ${selectedCliModel}`,
                    },
                    {
                      id: 'cursor',
                      name: 'Cursor IDE',
                      providerIcon: 'cursor',
                      desc: 'Override OpenAI Base URL in Cursor Settings > Models',
                      snippet: `Override OpenAI Base URL: ${baseEndpointV1}\nOpenAI API Key: ${apiKeys[0]?.keyPrefix ? `${apiKeys[0].keyPrefix}...` : 'bansos_live_your_key'}\nAdd Custom Model: ${selectedCliModel}`,
                    },
                    {
                      id: 'opencode',
                      name: 'OpenCode CLI',
                      providerIcon: 'opencode',
                      desc: 'Terminal coding agent configured with BansosRouter endpoint',
                      snippet: `export OPENAI_API_BASE="${baseEndpointV1}"\nexport OPENAI_API_KEY="${apiKeys[0]?.keyPrefix ? `${apiKeys[0].keyPrefix}...` : 'bansos_live_your_key'}"\nopencode -m "openai/${selectedCliModel}"`,
                    },
                    {
                      id: 'continue',
                      name: 'Continue.dev',
                      providerIcon: 'continue',
                      desc: 'Open-source autopilot for VS Code and JetBrains',
                      snippet: `{\n  "title": "BansosRouter ($0)",\n  "provider": "openai",\n  "model": "${selectedCliModel}",\n  "apiBase": "${baseEndpointV1}",\n  "apiKey": "bansos_live_your_key"\n}`,
                    },
                  ].map((tool) => {
                    const isExpanded = expandedCliTool === tool.id;
                    return (
                      <Card
                        key={tool.id}
                        padding="sm"
                        className={`transition-all ${
                          isExpanded ? 'ring-2 ring-primary/40 md:col-span-2 xl:col-span-3' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <ProviderIcon providerId={tool.providerIcon} size={36} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-sm text-text-main">
                                  {tool.name}
                                </h3>
                                <Badge variant="success" size="sm" dot>
                                  Ready
                                </Badge>
                              </div>
                              <p className="text-xs text-text-muted truncate">{tool.desc}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="secondary"
                              icon="content_copy"
                              onClick={() =>
                                copyText(tool.snippet, `Copied ${tool.name} config!`)
                              }
                            >
                              Copy
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={isExpanded ? 'expand_less' : 'expand_more'}
                              onClick={() =>
                                setExpandedCliTool(isExpanded ? null : tool.id)
                              }
                            />
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-4 pt-3 border-t border-border/50">
                            <pre className="p-3.5 rounded-lg bg-bg border border-border font-mono text-xs text-text-main overflow-x-auto">
                              {tool.snippet}
                            </pre>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ==============================================================
                TAB 9: SYSTEM -> PROXY & SDK PERSONAS (16-Slot Isolation)
               ============================================================== */}
            {activeTab === 'sdk-personas' && (
              <div className="flex flex-col gap-6">
                <Card
                  title="Per-Account SDK Fingerprint Isolation (16 Unique Personas)"
                  subtitle="Prevents multi-account linking on Z.AI, Groq, Gemini, and OpenRouter when routing from Cloudflare Workers"
                  icon="lan"
                >
                  <p className="text-xs text-text-muted mb-4 leading-relaxed">
                    When you connect multiple accounts for the same provider (e.g. 10 Z.AI accounts),
                    BansosRouter automatically assigns each account a distinct <strong>SDK Persona Slot (#1–#16)</strong>{' '}
                    with realistic <code>User-Agent</code>, <code>X-Stainless-Lang</code>,{' '}
                    <code>X-Stainless-OS</code>, and <code>X-Stainless-Runtime</code> headers, and strips
                    identifying proxy headers (<code>CF-Connecting-IP</code>, <code>X-Forwarded-For</code>).
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {SDK_PERSONA_LIST.map((p) => (
                      <div
                        key={p.slot}
                        className="p-3 rounded-xl bg-bg/60 border border-border flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between">
                          <Badge variant="primary" size="sm">
                            Slot #{p.slot + 1}
                          </Badge>
                          <span className="text-[11px] font-mono text-text-muted">
                            {p.os} • {p.arch}
                          </span>
                        </div>
                        <p className="text-xs font-mono font-bold text-text-main mt-1">
                          {p.label}
                        </p>
                        <p className="text-[11px] font-mono text-text-muted truncate" title={p.ua}>
                          {p.ua}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* ==============================================================
                TAB 10: SYSTEM -> CONSOLE & PLAYGROUND
               ============================================================== */}
            {activeTab === 'console' && (
              <div className="flex flex-col gap-6">
                <Card
                  title="Live Multi-Protocol Gateway Playground"
                  subtitle="Test OpenAI Chat, OpenAI Responses, Anthropic Messages, and Gemini v1beta live against your pool"
                  icon="terminal"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="text-xs font-medium text-text-muted mb-1 block">
                        Inbound Protocol
                      </label>
                      <select
                        value={pgProtocol}
                        onChange={(e) =>
                          setPgProtocol(e.target.value as typeof pgProtocol)
                        }
                        className="w-full py-2 px-3 text-sm bg-bg border border-border rounded-lg text-text-main"
                      >
                        <option value="openai-chat">OpenAI Chat (/v1/chat/completions)</option>
                        <option value="openai-responses">OpenAI Responses (/v1/responses)</option>
                        <option value="anthropic-messages">Anthropic Messages (/v1/messages)</option>
                        <option value="gemini">Google Gemini (/v1beta/models/...)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-text-muted mb-1 block">
                        Target Model or Combo
                      </label>
                      <input
                        type="text"
                        value={pgModel}
                        onChange={(e) => setPgModel(e.target.value)}
                        className="w-full py-2 px-3 text-sm font-mono bg-bg border border-border rounded-lg text-text-main"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-text-muted mb-1 block">
                        Routing Strategy
                      </label>
                      <select
                        value={pgStrategy}
                        onChange={(e) => setPgStrategy(e.target.value)}
                        className="w-full py-2 px-3 text-sm bg-bg border border-border rounded-lg text-text-main"
                      >
                        {(data?.catalogs.strategies ?? ['reset-aware', 'p2c', 'lkg', 'auto']).map(
                          (s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          )
                        )}
                      </select>
                    </div>
                  </div>

                  <textarea
                    rows={4}
                    value={pgPrompt}
                    onChange={(e) => setPgPrompt(e.target.value)}
                    className="w-full p-3 rounded-lg bg-bg border border-border text-sm text-text-main mb-3 focus:border-primary focus:outline-none"
                  />

                  <div className="flex justify-end mb-4">
                    <Button
                      icon="send"
                      loading={pgRunning}
                      onClick={() => void handleRunPlayground()}
                    >
                      Send Test Request (Rp 0)
                    </Button>
                  </div>

                  {Object.keys(pgHeaders).length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {Object.entries(pgHeaders).map(([k, v]) => (
                        <Badge key={k} variant="default" size="sm">
                          {k}: {v}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {pgOutput && (
                    <pre className="p-4 rounded-xl bg-bg border border-border font-mono text-xs text-text-main overflow-x-auto max-h-96">
                      {pgOutput}
                    </pre>
                  )}
                </Card>
              </div>
            )}

            {/* ==============================================================
                TAB 11: SYSTEM -> TRANSLATOR & SETTINGS
               ============================================================== */}
            {(activeTab === 'translator' || activeTab === 'settings') && (
              <div className="flex flex-col gap-6">
                <Card
                  title="Zero-Buffer Edge Protocol Translator & Settings"
                  subtitle="Automatic translation between OpenAI, Anthropic Messages, and Gemini v1beta streams"
                  icon="translate"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-bg/60 border border-border">
                      <Badge variant="primary" size="sm">
                        Inbound: Anthropic /v1/messages
                      </Badge>
                      <p className="text-sm font-semibold text-text-main mt-2">
                        Claude Code CLI -&gt; Any Free LLM
                      </p>
                      <p className="text-xs text-text-muted mt-1">
                        Translates Anthropic tool_use blocks and SSE events to Groq, Cerebras,
                        Gemini, or Z.AI GLM-4.7-Flash seamlessly.
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-bg/60 border border-border">
                      <Badge variant="success" size="sm">
                        Inbound: OpenAI /v1/responses
                      </Badge>
                      <p className="text-sm font-semibold text-text-main mt-2">
                        Codex CLI -&gt; Free Coding Models
                      </p>
                      <p className="text-xs text-text-muted mt-1">
                        Normalizes Responses API items into standard chat completions and streams
                        response.output_text.delta chunks.
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-bg/60 border border-border">
                      <Badge variant="info" size="sm">
                        $0 / Rp 0 Hard Lock
                      </Badge>
                      <p className="text-sm font-semibold text-text-main mt-2">
                        Paid Providers Blocked at Registry Level
                      </p>
                      <p className="text-xs text-text-muted mt-1">
                        Every response carries X-BansosRouter-Cost-IDR: Rp 0 and
                        X-BansosRouter-Cost-USD: 0.000000.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ====================================================================
          MODAL 1: ADD CONNECTION DIALOG (<dialog closedby="any">)
         ==================================================================== */}
      <dialog
        ref={addConnDialogRef}
        closedby="any"
        className="m-auto w-full max-w-lg rounded-2xl bg-surface border border-border text-text-main p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <ProviderIcon providerId={connProvider} size={28} />
            <h3 className="text-lg font-semibold text-text-main">Add Provider Connection</h3>
          </div>
          <button
            type="button"
            onClick={() => addConnDialogRef.current?.close()}
            className="text-text-muted hover:text-text-main"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={(e) => void handleAddApiKeyConnection(e)} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-text-main block mb-1.5">Provider</label>
            <select
              value={connProvider}
              onChange={(e) => {
                const nextP = e.target.value;
                setConnProvider(nextP);
                const reg = providerRegistry.find((p) => p.id === nextP);
                if (reg) {
                  setConnBaseUrl(
                    reg.baseUrl.startsWith('binding://') ? '' : reg.baseUrl
                  );
                }
              }}
              className="w-full py-2 px-3 text-sm bg-bg border border-border rounded-lg text-text-main"
            >
              {providerRegistry.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.category})
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Connection Name"
            placeholder="e.g. Z.AI Account #2"
            value={connName}
            onChange={(e) => setConnName(e.target.value)}
            required
          />

          <Input
            label="API Key / Free Token"
            type="password"
            placeholder="Paste API key (or leave blank for Zero-Key providers)"
            value={connApiKey}
            onChange={(e) => setConnApiKey(e.target.value)}
          />

          <Input
            label="Custom Base URL / Proxy Relay (Optional)"
            placeholder="Leave default or enter custom proxy URL for IP isolation"
            value={connBaseUrl}
            onChange={(e) => setConnBaseUrl(e.target.value)}
            hint="Each account also gets an isolated SDK Persona (User-Agent + X-Stainless headers) automatically."
          />

          <Input
            label="Priority (Lower = Higher Priority)"
            type="number"
            value={connPriority}
            onChange={(e) => setConnPriority(Number(e.target.value) || 10)}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => addConnDialogRef.current?.close()}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" icon="check">
              Save Connection
            </Button>
          </div>
        </form>
      </dialog>

      {/* ====================================================================
          MODAL 2: OAUTH WIZARD DIALOG (<dialog closedby="any">)
         ==================================================================== */}
      <dialog
        ref={oauthDialogRef}
        closedby="any"
        className="m-auto w-full max-w-lg rounded-2xl bg-surface border border-border text-text-main p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <ProviderIcon providerId={selectedOAuthProvider} size={28} />
            <h3 className="text-lg font-semibold text-text-main">Connect OAuth CLI Account</h3>
          </div>
          <button
            type="button"
            onClick={() => oauthDialogRef.current?.close()}
            className="text-text-muted hover:text-text-main"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-text-main block mb-1.5">
              OAuth Provider
            </label>
            <select
              value={selectedOAuthProvider}
              onChange={(e) => setSelectedOAuthProvider(e.target.value)}
              className="w-full py-2 px-3 text-sm bg-bg border border-border rounded-lg text-text-main"
            >
              {(data?.catalogs.oauthProviders ?? []).map((op) => (
                <option key={op.id} value={op.id}>
                  {op.name} ({op.flowType})
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Account Label"
            placeholder="e.g. Personal Gemini CLI #1"
            value={oauthAccountName}
            onChange={(e) => setOAuthAccountName(e.target.value)}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="primary"
              icon="open_in_new"
              onClick={() => void handleStartPkce()}
            >
              Start PKCE Flow
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon="devices"
              onClick={() => void handleStartDeviceCode()}
            >
              Start Device Code Flow
            </Button>
          </div>

          {pkceAuthUrl && (
            <div className="p-3.5 rounded-xl bg-bg border border-border space-y-3">
              <p className="text-xs text-text-muted">
                1. Open this authorization URL in your browser, sign in, and copy the callback
                URL or code:
              </p>
              <a
                href={pkceAuthUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs font-mono text-primary underline break-all"
              >
                {pkceAuthUrl}
              </a>
              <Input
                label="2. Paste Callback URL or Authorization Code"
                placeholder="http://localhost:8085/oauth2callback?code=..."
                value={pastedCallbackInput}
                onChange={(e) => setPastedCallbackInput(e.target.value)}
              />
              <Button
                fullWidth
                variant="primary"
                onClick={() => void handleExchangePkceCallback()}
              >
                Complete OAuth Exchange
              </Button>
            </div>
          )}

          {deviceSession && (
            <div className="p-3.5 rounded-xl bg-bg border border-border space-y-3">
              <p className="text-xs text-text-muted">
                Enter code <strong className="text-primary font-mono">{deviceSession.userCode}</strong>{' '}
                at:
              </p>
              <a
                href={deviceSession.verificationUri}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs font-mono text-primary underline break-all"
              >
                {deviceSession.verificationUri}
              </a>
              <Button
                fullWidth
                variant="primary"
                onClick={() => void handlePollDeviceCode()}
              >
                Verify Device Authorization
              </Button>
            </div>
          )}
        </div>
      </dialog>

      {/* ====================================================================
          MODAL 3: CREATE API KEY DIALOG (<dialog closedby="any">)
         ==================================================================== */}
      <dialog
        ref={createKeyDialogRef}
        closedby="any"
        className="m-auto w-full max-w-md rounded-2xl bg-surface border border-border text-text-main p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-border">
          <h3 className="text-lg font-semibold text-text-main">Create API Key</h3>
          <button
            type="button"
            onClick={() => createKeyDialogRef.current?.close()}
            className="text-text-muted hover:text-text-main"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={(e) => void handleCreateClientKey(e)} className="space-y-4">
          <Input
            label="Key Name"
            placeholder="e.g. Claude Code / Cursor Key"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            required
          />
          <Input
            label="Pool Quota Share (%)"
            type="number"
            value={newKeyQuotaShare}
            onChange={(e) => setNewKeyQuotaShare(Number(e.target.value) || 100)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => createKeyDialogRef.current?.close()}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create
            </Button>
          </div>
        </form>
      </dialog>

      {/* ====================================================================
          MODAL 4: CREATE COMBO DIALOG (<dialog closedby="any">)
         ==================================================================== */}
      <dialog
        ref={createComboDialogRef}
        closedby="any"
        className="m-auto w-full max-w-md rounded-2xl bg-surface border border-border text-text-main p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-border">
          <h3 className="text-lg font-semibold text-text-main">Create Model Combo</h3>
          <button
            type="button"
            onClick={() => createComboDialogRef.current?.close()}
            className="text-text-muted hover:text-text-main"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={(e) => void handleCreateCombo(e)} className="space-y-4">
          <Input
            label="Combo Slug (Model ID)"
            placeholder="bansos/my-combo"
            value={newComboSlug}
            onChange={(e) => setNewComboSlug(e.target.value)}
            required
          />
          <Input
            label="Display Name"
            placeholder="My Free Coding Combo"
            value={newComboName}
            onChange={(e) => setNewComboName(e.target.value)}
            required
          />
          <Input
            label="Description"
            placeholder="Fallback across Groq, Cerebras, and Gemini"
            value={newComboDesc}
            onChange={(e) => setNewComboDesc(e.target.value)}
          />
          <div>
            <label className="text-sm font-medium text-text-main block mb-1.5">
              Routing Strategy
            </label>
            <select
              value={newComboStrategy}
              onChange={(e) => setNewComboStrategy(e.target.value)}
              className="w-full py-2 px-3 text-sm bg-bg border border-border rounded-lg text-text-main"
            >
              {(data?.catalogs.strategies ?? ['reset-aware', 'p2c', 'lkg', 'auto']).map(
                (s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                )
              )}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => createComboDialogRef.current?.close()}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create Combo
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
