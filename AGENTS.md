# BansosRouter — Project Context & Agent Instructions

## Ringkasan Proyek
**BansosRouter** (`/Users/ridloabelian/Github/bansosrouter`) adalah varian khusus dari `flareroute` yang didedikasikan **100% untuk provider & model LLM Free-Tier, Kredit Bansos (`$10–$100`), OAuth CLI Gratis, dan Zero-Key Community Endpoints**.

- **Prinsip Utama (`$0 / Rp 0 Lock`)**:
  - Dilarang menambahkan model atau provider berbayar murni (`paid` / PAYG).
  - Semua model di [`src/lib/catalogs.ts`](./src/lib/catalogs.ts) wajib memiliki `inputCostPer1M: 0` dan `outputCostPer1M: 0`.
  - Semua respons gateway wajib menyertakan `X-BansosRouter-Cost-IDR: Rp 0` dan `X-BansosRouter-Cost-USD: 0.000000`.
  - Prefix client API key menggunakan `bansos_live_...`.

## 7 Sumber Rujukan Katalog Bansos LLM
1. `https://github.com/tashfeenahmed/freellmapi`
2. `https://github.com/wauputr4/bansos`
3. `https://bansos.dev/list/`
4. `https://github.com/open-free-llm-api/awesome-freellm-apis`
5. `https://github.com/nejib1/Free-LLM`
6. `https://github.com/mnfst/awesome-free-llm-apis`
7. `https://github.com/12britz/awesome-free-models`

## Struktur File Utama
- [`src/lib/catalogs.ts`](./src/lib/catalogs.ts) — Katalog 24+ sumber LLM gratis (`FREE_TIER_CATALOG`, ~8.9+ Miliar token/bulan), metadata `creditCardPolicy` (`no_cc`, `zero_key`, `oauth_free`, `phone_only`, `free_credits`), `claimSteps`, dan `BANSOS_VERIFICATION_WATCHLIST` (Watchlist Anti-Boncos).
- [`src/lib/provider-registry.ts`](./src/lib/provider-registry.ts) — Registri provider yang telah difilter khusus non-berbayar (`tier !== 'paid'`) + provider komunitas/bansos (`hetzner`, `aionlabs`, `bazaarlink`, `freeai`, `agnes`, `bynara`, `artbloom`, `kie-ai`).
- [`src/lib/router.ts`](./src/lib/router.ts) & [`src/db/index.ts`](./src/db/index.ts) — Mesin routing 19 strategi + 7 virtual combo `bansos/*` (`bansos/auto`, `bansos/no-cc`, `bansos/coding`, `bansos/reasoning`, `bansos/fast`, `bansos/million-context`, `bansos/indo`).
- [`src/routes/gateway.ts`](./src/routes/gateway.ts) & [`src/routes/admin.ts`](./src/routes/admin.ts) — Multi-protocol gateway (`/v1/chat/completions`, `/v1/responses`, `/v1/messages`, `/v1beta/models/...`) dan API admin termasuk `/api/admin/connections/seed-demo` (7 starter koneksi gratis).
- [`src/sse/executor.ts`](./src/sse/executor.ts) — Zero-buffer SSE streaming + **16-Slot Per-Account SDK Fingerprint Isolation** (`SDK_FINGERPRINT_POOL`) untuk mencegah deteksi multi-akun di belakang IP Cloudflare.
- [`src/client/NineRouterUI.tsx`](./src/client/NineRouterUI.tsx) & [`src/client/App.tsx`](./src/client/App.tsx) — Dashboard BansosRouter dengan arsitektur GUI identik **9Router** dan palet warna **Emerald Hijau Cuan (`#10B981`)**.

## Deployment & Repositori
- **Live Cloudflare Worker**: `https://bansosrouter.ridloabelian.workers.dev`
- **GitHub Repository**: `https://github.com/ridloabelian/bansosrouter` (Branch `main` protected via GitHub Ruleset)
- **Riwayat Sesi Antigravity**:
  - Sesi 1: `1ed0f073-f25e-4830-9d61-3b0e60a8cb69`
  - Sesi 2: `3ba15b1f-d11c-4e9e-9906-7937e7b0ef18`
