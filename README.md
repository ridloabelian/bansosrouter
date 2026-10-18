# 🎁 BansosRouter — Router AI Bantuan Sosial 100% Gratis (`Rp 0 / $0 Lock`)

**BansosRouter** adalah varian khusus dari `flareroute` yang dibangun **100% khusus untuk menampung LLM Free-Tier, Kredit Bansos (`$10–$100`), OAuth CLI Gratis, dan Zero-Key Community Endpoints**.

Seluruh model berbayar murni (PAYG) telah dihapus dari katalog dan biaya pemakaian dikunci secara permanen di **`Rp 0 ($0.00 Lock)`** sehingga developer jelata, mahasiswa, dan peneliti bisa menggabungkan **24+ sumber LLM gratis (~8.9+ Miliar token gratis/bulan)** menjadi satu endpoint OpenAI / Anthropic / Gemini / Responses yang tahan banting (anti-limit HTTP 429).

---

## 📚 7 Sumber Rujukan Utama Katalog Bansos LLM

Katalog provider dan model gratis di dalam [`src/lib/catalogs.ts`](./src/lib/catalogs.ts) dan [`src/lib/provider-registry.ts`](./src/lib/provider-registry.ts) disintesis dan diverifikasi langsung dari 7 repositori komunitas:

1. [`wauputr4/bansos`](https://github.com/wauputr4/bansos) — *Bantuan Sosial untuk para fakir token dan pengemis cloud credit*
2. [`bansos.dev/list`](https://bansos.dev/list/) — Direktori program kredit AI & cloud gratis untuk developer Indonesia
3. [`tashfeenahmed/freellmapi`](https://github.com/tashfeenahmed/freellmapi) — *~9+ Billion Free LLM Tokens/Month across 20+ providers*
4. [`open-free-llm-api/awesome-freellm-apis`](https://github.com/open-free-llm-api/awesome-freellm-apis) — Kurasi API LLM gratis dengan kuota harian/bulanan
5. [`nejib1/Free-LLM`](https://github.com/nejib1/Free-LLM) — Daftar endpoint LLM gratis & playground tanpa biaya
6. [`mnfst/awesome-free-llm-apis`](https://github.com/mnfst/awesome-free-llm-apis) — Rujukan rate-limit RPM/RPD/TPM untuk tiap provider gratis
7. [`12britz/awesome-free-models`](https://github.com/12britz/awesome-free-models) — Verifikasi komunitas mengenai kebijakan kartu kredit (`No CC` vs `Phone Only`) & **Watchlist Anti-Boncos** (provider yang sudah menghapus free tier-nya)

---

## ✨ Fitur Utama BansosRouter

- **🔒 100% Zero-Cost (`$0 / Rp 0 Lock`)**:
  - Semua model di [`MODEL_CATALOG`](./src/lib/catalogs.ts) memiliki `inputCostPer1M: 0` dan `outputCostPer1M: 0`.
  - Setiap respons gateway menyertakan header transparansi `X-BansosRouter-Cost-IDR: Rp 0` dan `X-BansosRouter-Cost-USD: 0.000000`.
- **💳 Filter Kebijakan Kartu Kredit (`No Credit Card` Transparency)**:
  - **`no_cc` (Tanpa Kartu Kredit)**: Google AI Studio, Groq, Cerebras, OpenRouter (`:free`), Mistral La Plateforme, GitHub Models, Cohere Trial, SambaNova, HuggingFace, Cloudflare Workers AI, Chutes.ai, Together AI, Clarifai,Glhf.chat, Sahabat-AI.
  - **`zero_key` (Tanpa Registrasi / Langsung Jalan)**: Pollinations.AI (`text.pollinations.ai/openai`), MLab / Isles Proxy, FreeAI / Agnes / Bynara.
  - **`oauth_free` (Login Akun Gratis)**: Qwen Code CLI OAuth (2.000 req/hari gratis), Gemini CLI OAuth (1.000 req/hari gratis).
  - **`phone_only` (Verifikasi Nomor HP Saja)**: NVIDIA NIM (`build.nvidia.com`), Scaleway Generative APIs.
  - **`free_credits` (Bansos Saldo Gratis `$10–$100`)**: Fireworks AI (`$1`), Nebius AI Studio (`$1`–`$10`), SiliconFlow (`¥14`), Novita AI (`$0.50`–`$5`), Hyperbolic (`$1`–`$10`), Baseten (`$30`), Modal (`$30/bln`).
- **🧭 7 Virtual Combo `bansos/*` Pintar**:
  - `bansos/auto` — Menggabungkan seluruh akun gratis aktif Anda dengan algoritma `reset-aware`.
  - `bansos/no-cc` — **100% Murni Tanpa Kartu Kredit & Tanpa Verifikasi HP** (`NO_CC_PROVIDERS`).
  - `bansos/coding` — Khusus coding agent (Claude Code, Codex CLI, Cursor, Cline, Aider) menggunakan Qwen3-Coder-480B, Codestral, DeepSeek-V3, dan Gemini 2.5 Pro.
  - `bansos/reasoning` — Khusus penalaran berat (`DeepSeek-R1`, `QwQ-32B`, `Gemini 2.5 Pro`).
  - `bansos/fast` — Latensi ultra-rendah <80ms (`Groq` + `Cerebras` + `SambaNova`).
  - `bansos/million-context` — Konteks raksasa 1 Juta token (`Gemini 2.5 Pro` + `Gemini 2.5 Flash`).
  - `bansos/indo` — Dioptimalkan untuk Bahasa Indonesia & daerah (`Sahabat-AI`, `SEA-LION v3`, `Gemini 2.5`, `Qwen3`).
- **🛡️ 3-Layer Anti-Limit & Self-Healing Resilience (Cloudflare KV)**:
  - Ketika satu model di akun gratis Anda terkena `HTTP 429 Too Many Requests`, **Layer 3 Per-Model Lockout** hanya mengistirahatkan pasangan `(connection_id, model)` tersebut tanpa mematikan model gratis lain di akun yang sama, lalu otomatis memindahkan trafik ke provider Bansos berikutnya!
- **🗜️ 10-Layer Pure-TypeScript Penghemat Kuota Token**:
  - Menghemat hingga 45%+ pemakaian token harian agar jatah RPD/TPM gratis Anda tidak cepat habis.

---

## 🚀 Cara Menjalankan & Deploy ke Cloudflare Workers (100% Gratis)

1. **Install dependensi**:
   ```bash
   npm install
   ```

2. **Inisialisasi database lokal Cloudflare D1 & jalankan server pengembangan**:
   ```bash
   npm run db:init:local
   npm run dev
   ```

3. **Pemeriksaan tipe TypeScript & build produksi**:
   ```bash
   npm run typecheck
   npm run build
   ```

4. **Deploy ke Cloudflare Workers Free Tier**:
   ```bash
   npx wrangler d1 create bansosrouter-db
   npx wrangler kv namespace create FLAREROUTE_KV
   npm run deploy
   ```
