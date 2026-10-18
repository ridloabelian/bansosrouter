import React, { useState, useRef, useEffect } from 'react';

export type NavTab =
  | 'endpoint'
  | 'providers'
  | 'free-tiers'
  | 'combos'
  | 'usage'
  | 'quota'
  | 'token-saver'
  | 'cli-tools'
  | 'sdk-personas'
  | 'translator'
  | 'console'
  | 'settings';

export const PROVIDER_PNG_MAP: Record<string, string> = {
  gemini: 'gemini',
  'gemini-cli': 'gemini-cli',
  antigravity: 'antigravity',
  groq: 'groq',
  cerebras: 'cerebras',
  nvidia: 'nvidia',
  openrouter: 'openrouter',
  chutes: 'chutes',
  mistral: 'mistral',
  'mistral-codestral': 'mistral',
  cohere: 'cohere',
  huggingface: 'huggingface',
  'github-models': 'github',
  github: 'github',
  copilot: 'copilot',
  codex: 'codex',
  claude: 'claude',
  anthropic: 'anthropic',
  openai: 'openai',
  'qwen-oauth': 'qwen',
  qwen: 'qwen',
  alicode: 'alicode',
  'alicode-intl': 'alicode-intl',
  iflow: 'iflow',
  kiro: 'kiro',
  cursor: 'cursor',
  kilocode: 'kilocode',
  cline: 'cline',
  roo: 'roo',
  continue: 'continue',
  opencode: 'opencode',
  'opencode-zen': 'opencode',
  'opencode-go': 'opencode-go',
  openclaw: 'openclaw',
  'workers-ai': 'cloudflare-ai',
  'cloudflare-ai': 'cloudflare-ai',
  bigmodel: 'glm',
  glm: 'glm',
  'glm-cn': 'glm-cn',
  deepseek: 'deepseek',
  kimi: 'kimi',
  'kimi-coding': 'kimi-coding',
  minimax: 'minimax',
  'minimax-cn': 'minimax-cn',
  siliconflow: 'siliconflow',
  nebius: 'nebius',
  hyperbolic: 'hyperbolic',
  fireworks: 'fireworks',
  together: 'together',
  byteplus: 'byteplus',
  'volcengine-ark': 'volcengine-ark',
  vertex: 'vertex',
  perplexity: 'perplexity',
  'perplexity-web': 'perplexity-web',
  'grok-web': 'grok-web',
  xai: 'xai',
  'mimo-free': 'mimo-free',
  'xiaomi-mimo': 'xiaomi-mimo',
  ollama: 'ollama',
  'ollama-local': 'ollama-local',
  blackbox: 'blackbox',
};

export function ProviderIcon({
  providerId,
  textIcon,
  color = '#E56A4A',
  size = 32,
  className = '',
}: {
  providerId: string;
  textIcon?: string;
  color?: string;
  size?: number;
  className?: string;
}): React.ReactElement {
  const [imgError, setImgError] = useState(false);
  const pngSlug = PROVIDER_PNG_MAP[providerId] ?? providerId;

  if (!imgError) {
    return (
      <img
        src={`/providers/${pngSlug}.png`}
        alt={providerId}
        width={size}
        height={size}
        className={`object-contain rounded-lg shrink-0 ${className}`}
        style={{ width: size, height: size }}
        onError={() => setImgError(true)}
      />
    );
  }

  const label = (textIcon || providerId.slice(0, 2)).toUpperCase().slice(0, 3);
  return (
    <div
      className={`inline-flex items-center justify-center rounded-lg font-bold shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: `${color}18`,
        color: color,
        fontSize: Math.max(10, Math.floor(size * 0.36)),
      }}
    >
      {label}
    </div>
  );
}

export function Card({
  children,
  title,
  subtitle,
  icon,
  action,
  padding = 'md',
  hover = false,
  className = '',
  onClick,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  icon?: string;
  action?: React.ReactNode;
  padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}): React.ReactElement {
  const paddings: Record<string, string> = {
    none: 'p-0',
    xs: 'p-3',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };
  return (
    <div
      onClick={onClick}
      className={`bg-surface border border-border rounded-xl shadow-[var(--shadow-soft)] ${
        hover ? 'hover:border-primary/40 hover:bg-surface/80 transition-all cursor-pointer' : ''
      } ${paddings[padding]} ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            {icon && (
              <span className="material-symbols-outlined text-[20px] text-primary">{icon}</span>
            )}
            <div>
              {title && <h2 className="text-lg font-semibold text-text-main">{title}</h2>}
              {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  fullWidth = false,
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  onClick,
  title,
}: {
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  iconRight?: string;
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
}): React.ReactElement {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 cursor-pointer focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';

  const variants: Record<string, string> = {
    primary:
      'bg-gradient-to-b from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white shadow-[0_2px_10px_-2px_rgba(229,106,74,0.4)] active:scale-[0.99]',
    secondary:
      'bg-surface border border-border text-text-main hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.99]',
    outline:
      'border border-border text-text-main hover:bg-black/5 dark:hover:bg-white/5',
    ghost:
      'text-text-muted hover:text-text-main hover:bg-black/5 dark:hover:bg-white/5',
    danger:
      'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20',
  };

  const sizes: Record<string, string> = {
    sm: 'px-2.5 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2',
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      title={title}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
    >
      {loading ? (
        <span className="material-symbols-outlined animate-spin text-[16px]">
          progress_activity
        </span>
      ) : icon ? (
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      ) : null}
      {children}
      {iconRight && !loading && (
        <span className="material-symbols-outlined text-[18px]">{iconRight}</span>
      )}
    </button>
  );
}

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  icon,
  className = '',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  icon?: string;
  className?: string;
}): React.ReactElement {
  const variants: Record<string, string> = {
    default: 'bg-black/5 dark:bg-white/10 text-text-muted border-transparent',
    primary: 'bg-primary/15 text-primary border-primary/20',
    success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20',
    error: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20',
    info: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
  };

  const dotColors: Record<string, string> = {
    default: 'bg-gray-400',
    primary: 'bg-primary',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  };

  const sizes: Record<string, string> = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-0.5 text-xs',
    lg: 'px-3 py-1 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {dot && <span className={`size-1.5 rounded-full ${dotColors[variant]}`} />}
      {icon && <span className="material-symbols-outlined text-[14px]">{icon}</span>}
      {children}
    </span>
  );
}

export function Toggle({
  checked = false,
  onChange,
  disabled = false,
  size = 'md',
  label,
  description,
  className = '',
}: {
  checked?: boolean;
  onChange?: (val: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  description?: string;
  className?: string;
}): React.ReactElement {
  const sizes = {
    sm: { track: 'w-8 h-4', thumb: 'size-3', translate: 'translate-x-4' },
    md: { track: 'w-11 h-6', thumb: 'size-5', translate: 'translate-x-5' },
    lg: { track: 'w-14 h-7', thumb: 'size-6', translate: 'translate-x-7' },
  };
  const s = sizes[size];
  const toggleEl = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled && onChange) onChange(!checked);
      }}
      className={`relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        s.track
      } ${checked ? 'bg-primary' : 'bg-black/20 dark:bg-white/20'} ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${!label ? className : ''}`}
    >
      <span
        className={`pointer-events-none inline-block rounded-full bg-white shadow-sm transform ring-0 transition duration-200 ease-in-out ${
          s.thumb
        } ${checked ? s.translate : 'translate-x-0'}`}
      />
    </button>
  );

  if (!label && !description) return toggleEl;

  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      <div>
        {label && <p className="text-sm font-medium text-text-main">{label}</p>}
        {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
      </div>
      {toggleEl}
    </div>
  );
}

export function Input({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  error,
  hint,
  icon,
  disabled = false,
  required = false,
  className = '',
  inputClassName = '',
}: {
  label?: string;
  type?: string;
  placeholder?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  hint?: string;
  icon?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  inputClassName?: string;
}): React.ReactElement {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-text-main">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-text-muted">
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`w-full py-2 px-3 text-sm text-text-main bg-surface border border-border rounded-lg placeholder:text-text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all disabled:opacity-50 ${
            icon ? 'pl-10' : ''
          } ${error ? 'border-red-500' : ''} ${inputClassName}`}
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

export function SegmentedControl({
  options,
  value,
  onChange,
  size = 'md',
  className = '',
}: {
  options: Array<{ value: string; label: string; icon?: string }>;
  value: string;
  onChange: (val: string) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}): React.ReactElement {
  const sizes: Record<string, string> = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3.5 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };
  return (
    <div
      className={`inline-flex items-center p-1 rounded-lg bg-surface/60 border border-border ${className}`}
      role="tablist"
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center gap-1.5 rounded-md font-medium transition-all ${
              sizes[size]
            } ${
              active
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            {opt.icon && (
              <span className="material-symbols-outlined text-[16px] leading-none">
                {opt.icon}
              </span>
            )}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export const MAIN_NAV_ITEMS: Array<{
  id: NavTab;
  label: string;
  icon: string;
  title: string;
  description: string;
}> = [
  {
    id: 'endpoint',
    label: 'Endpoint',
    icon: 'api',
    title: 'API Endpoint & Keys',
    description: 'Manage gateway URLs and client API keys ($0 / Rp 0 Lock)',
  },
  {
    id: 'providers',
    label: 'Providers',
    icon: 'dns',
    title: 'Providers',
    description: 'Manage your AI provider connections & Per-Account SDK Fingerprint Isolation',
  },
  {
    id: 'free-tiers',
    label: 'Bansos Free Tiers',
    icon: 'redeem',
    title: 'Katalog 24+ Bansos LLM (Rp 0)',
    description: '~9.1 Billion Free Tokens/Month • Zero Credit Card Filter • Anti-Boncos Watchlist',
  },
  {
    id: 'combos',
    label: 'Combos',
    icon: 'layers',
    title: 'Combos',
    description: 'Create model combos with Fallback, Round-Robin, Fusion, and 19 Routing Strategies',
  },
  {
    id: 'usage',
    label: 'Usage',
    icon: 'bar_chart',
    title: 'Usage & Analytics',
    description: 'Monitor real-time token usage, request telemetry, and Rp 0 cost lock',
  },
  {
    id: 'quota',
    label: 'Quota Tracker',
    icon: 'data_usage',
    title: 'Quota Tracker & 3-Layer Resilience',
    description: 'Track 5-hour window quotas, daily limits, and Layer 3 Per-Model Lockouts',
  },
  {
    id: 'token-saver',
    label: 'Token Saver',
    icon: 'savings',
    title: 'Token Saver',
    description: 'Reduce input & output token usage with RTK, Headroom, Caveman Mode & 10-Layer Pipeline',
  },
  {
    id: 'cli-tools',
    label: 'CLI Tools',
    icon: 'terminal',
    title: 'CLI Tools',
    description: 'Configure Claude Code, Codex CLI, Cline, Cursor, Aider, and OpenCode in 1 click',
  },
];

export const SYSTEM_NAV_ITEMS: Array<{
  id: NavTab;
  label: string;
  icon: string;
  title: string;
  description: string;
}> = [
  {
    id: 'sdk-personas',
    label: 'Proxy & SDK Personas',
    icon: 'lan',
    title: 'Per-Account SDK Fingerprint & Proxy Pool',
    description: '16 Unique SDK Personas (Claude CLI, Cursor, Cline, OpenAI Python/Node, Go, Rust) per account',
  },
  {
    id: 'console',
    label: 'Console',
    icon: 'terminal',
    title: 'Live Gateway Console & Playground',
    description: 'Test OpenAI Chat, Responses API, Anthropic Messages, and Gemini v1beta live',
  },
  {
    id: 'translator',
    label: 'Translator',
    icon: 'translate',
    title: 'Multi-Protocol Translator',
    description: 'Inspect how OpenAI, Anthropic, and Gemini payloads translate across edge streams',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'settings',
    title: 'System Settings',
    description: 'Configure routing defaults, KV resilience, and BansosRouter $0 Lock',
  },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  onCloseMobile,
}: {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onCloseMobile?: () => void;
}): React.ReactElement {
  return (
    <aside className="flex flex-col w-72 h-full border-r border-border-subtle bg-vibrancy backdrop-blur-xl transition-colors duration-300">
      {/* macOS Traffic Lights */}
      <div className="p-4 pt-5 pb-2">
        <div className="traffic-lights">
          <div className="traffic-light red" />
          <div className="traffic-light yellow" />
          <div className="traffic-light green" />
        </div>
      </div>

      {/* App Logo (Identical to 9Router) */}
      <div className="px-6 py-4 mb-2 flex items-center gap-3">
        <div className="size-9 rounded-[10px] bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white shrink-0 shadow-[var(--shadow-warm)]">
          <span className="material-symbols-outlined text-[20px]">hub</span>
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-semibold tracking-tight text-base text-text-main leading-none">
              BansosRouter
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-text-muted leading-none">
              v1.0.0
            </span>
          </div>
          <span className="text-[11px] text-emerald-500 font-medium mt-1">
            9Router UI • Rp 0 / $0 Lock
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
        {MAIN_NAV_ITEMS.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile?.();
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all group text-left ${
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-muted hover:bg-surface/50 hover:text-text-main'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[18px] transition-colors ${
                  active ? 'text-primary fill-1' : 'group-hover:text-text-main'
                }`}
              >
                {item.icon}
              </span>
              <span className="text-[13px] font-medium flex-1">{item.label}</span>
              {item.id === 'free-tiers' && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500">
                  24+
                </span>
              )}
            </button>
          );
        })}

        {/* System Section */}
        <div className="pt-4 mt-4 border-t border-border/50">
          <p className="px-4 text-xs font-semibold text-text-muted/60 uppercase tracking-wider mb-2">
            System
          </p>
          {SYSTEM_NAV_ITEMS.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile?.();
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all group text-left ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-muted hover:bg-surface/50 hover:text-text-main'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-[18px] transition-colors ${
                    active ? 'text-primary fill-1' : 'group-hover:text-text-main'
                  }`}
                >
                  {item.icon}
                </span>
                <span className="text-[13px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}

export function Header({
  activeTab,
  selectedProviderDetail,
  onClearProviderDetail,
  searchQuery,
  onSearchChange,
  theme,
  onToggleTheme,
  onSeedDemo,
  onLogout,
  onOpenMobileMenu,
}: {
  activeTab: NavTab;
  selectedProviderDetail: { id: string; name: string } | null;
  onClearProviderDetail: () => void;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onSeedDemo: () => void;
  onLogout: () => void;
  onOpenMobileMenu: () => void;
}): React.ReactElement {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const navMeta =
    [...MAIN_NAV_ITEMS, ...SYSTEM_NAV_ITEMS].find((i) => i.id === activeTab) ??
    MAIN_NAV_ITEMS[0];

  const showSearch = activeTab === 'providers' || activeTab === 'free-tiers';

  return (
    <header className="flex items-center justify-between px-8 py-5 border-b border-border/50 bg-bg/80 backdrop-blur-md sticky top-0 z-30">
      {/* Left: Mobile Menu + Breadcrumbs / Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="flex lg:hidden items-center justify-center size-10 rounded-lg text-text-muted hover:text-text-main hover:bg-surface transition-colors"
          aria-label="Open menu"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>

        {activeTab === 'providers' && selectedProviderDetail ? (
          <div>
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={onClearProviderDetail}
                className="text-text-muted hover:text-text-main transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[18px]">dns</span>
                <span>Providers</span>
              </button>
              <span className="material-symbols-outlined text-text-muted text-[16px]">
                chevron_right
              </span>
              <span className="font-semibold text-text-main">
                {selectedProviderDetail.name}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              Manage {selectedProviderDetail.name} connections, SDK Persona slots, and models
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold text-text-main tracking-tight">
                {navMeta.title}
              </h1>
              <p className="text-sm text-text-muted">{navMeta.description}</p>
            </div>
          </div>
        )}
      </div>

      {/* Right: Search + Rp 0 Lock Badge + ThemeToggle + HeaderMenu */}
      <div className="flex items-center gap-3">
        {showSearch && !selectedProviderDetail && (
          <div className="relative hidden md:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search providers or models..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-9 w-56 rounded-lg border border-border bg-surface pl-9 pr-8 text-sm text-text-main placeholder:text-text-muted focus:border-primary focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </div>
        )}

        {/* 100% Free-Tier Rp 0 Lock Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <span className="material-symbols-outlined text-[15px]">verified</span>
          <span>Rp 0 / $0 Lock</span>
        </div>

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          aria-pressed={theme === 'dark'}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          className="flex items-center justify-center size-10 rounded-full text-text-muted hover:text-text-main hover:bg-surface border border-transparent hover:border-border transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">
            {theme === 'dark' ? 'light_mode' : 'dark_mode'}
          </span>
        </button>

        {/* 9Router App Menu Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className={`flex items-center justify-center size-10 rounded-full border transition-all ${
              menuOpen
                ? 'bg-primary/10 text-primary border-primary/30'
                : 'text-text-muted hover:text-text-main hover:bg-surface border-transparent hover:border-border'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">grid_view</span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-60 rounded-xl bg-surface border border-border shadow-xl py-2 z-50">
              <div className="px-3 py-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-text-muted">Theme</span>
                <div className="flex items-center gap-1 bg-bg p-0.5 rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => {
                      if (theme !== 'light') onToggleTheme();
                    }}
                    className={`p-1 rounded-md transition-all ${
                      theme === 'light'
                        ? 'bg-surface text-primary shadow-xs'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px] block">
                      light_mode
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (theme !== 'dark') onToggleTheme();
                    }}
                    className={`p-1 rounded-md transition-all ${
                      theme === 'dark'
                        ? 'bg-surface text-primary shadow-xs'
                        : 'text-text-muted hover:text-text-main'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px] block">
                      dark_mode
                    </span>
                  </button>
                </div>
              </div>

              <div className="my-1 border-t border-border" />

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onSeedDemo();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-text-muted hover:text-text-main hover:bg-bg/60 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px] text-emerald-500">
                  auto_awesome
                </span>
                <span>Seed 7 Free Starter Providers</span>
              </button>

              <a
                href="https://github.com/ridloabelian/bansosrouter"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-sm text-text-muted hover:text-text-main hover:bg-bg/60 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">code</span>
                <span>GitHub Repository</span>
                <span className="material-symbols-outlined text-[14px] ml-auto opacity-50">
                  open_in_new
                </span>
              </a>

              <div className="my-1 border-t border-border" />

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
