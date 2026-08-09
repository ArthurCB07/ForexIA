# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Forex IA Studio — a local-first web app for importing forex candle data, backtesting/optimizing trading strategies, and exporting them as MT5 (MetaTrader 5) Expert Advisors. It's a single-page React app backed by a JSON-file "database" (no real DB), plus a set of MQ5 EA files that get generated/paired with the backend.

## Commands

```bash
npm start   # runs both server.cjs (API, port 3001) and vite dev server (port 5173) via concurrently
npm run dev     # vite only
npm run server  # node server.cjs only
npm run reset   # wipes data/datasets/*.json and resets data/db.json (reset-data.cjs)
```

There is no lint, typecheck, or test script configured — `tsconfig.json` has `noEmit: true` / `strict: false` and is only used by Vite/esbuild for transpilation, not for a separate `tsc` check.

The frontend dev server proxies `/api/*` to `http://localhost:3001` (see [vite.config.ts](vite.config.ts)); the Express server must be running for the UI to load real data.

## Architecture

### Entry points and duplication trap

- The real frontend source is [src/main.tsx](src/main.tsx) + [src/styles.css](src/styles.css), loaded via [index.html](index.html). It's one large single-file React app (no component files/router — routing is a `useState<Page>` switch).
- There are **stale duplicate copies** at the repo root ([main.tsx](main.tsx), [styles.css](styles.css)) and under [patch/](patch/) — these are old snapshots, not part of the build. Always edit `src/main.tsx` / `src/styles.css`. Diff before assuming which copy is current.
- [server.cjs](server.cjs) is a single ~3000-line Express file (no route modules) that owns almost all backend logic: dataset import/candles, backtesting, optimizer, robot/strategy CRUD, MT5 validation, WhatsApp/Evolution API integration, forward-testing. The only extracted modules are `billing/` and `v2/`, both mounted via `require(...)({app, ...})`.

### Auth, wallet and payments (Supabase + Mercado Pago)

User accounts and credits do **not** live in `data/db.json` — they're in Supabase Postgres:

- [billing/supabase-client.cjs](billing/supabase-client.cjs) — thin `fetch` wrappers over Supabase's REST APIs (GoTrue `/auth/v1/*` with the anon key; PostgREST `/rest/v1/*` with the service role key, which bypasses RLS). No `@supabase/supabase-js` dependency by design — matches the existing `fetch`-based Evolution API integration.
- [billing/routes.cjs](billing/routes.cjs) — mounted from `server.cjs` and exports `{authMiddleware, chargeWallet}`. Owns `/api/auth/*`, `/api/profile`, `/api/wallet/*`, plus `BILLING_PRICES` (per-indicator pricing: create R$0.26, backtest R$0.10, optimizer R$0.50).
- Credentials come from `.env` (gitignored) via `dotenv`, loaded on line 2 of `server.cjs`. **`SUPABASE_SERVICE_ROLE_KEY` is backend-only** — never expose it to the frontend.
- Schema lives in [supabase/schema.sql](supabase/schema.sql) and must be applied manually in the Supabase SQL Editor (no migration runner). It is written to be idempotent and re-runnable: `profiles` already existed in this Supabase project from an unrelated app, so the wallet columns are added via `alter table ... add column if not exists` rather than in the `create table`.

Billing rules enforced in `chargeWallet`: the first robot creation and first backtest per user are free (tracked by `free_robot_used` / `free_backtest_used` on `profiles`); the genetic optimizer is always charged. On insufficient balance it throws an error carrying `{status: 402, code: 'INSUFFICIENT_CREDITS', cost, balance}`, which each route passes through as JSON and the frontend's `billingErrorInfo()` turns into a "recarregue no Perfil" CTA.

PIX top-ups create a Mercado Pago payment, then confirm by **polling** `/api/wallet/topup/pix/:id/status` (the server runs on localhost, so the webhook at `/api/wallet/webhook/mercadopago` is wired but unreachable in dev). `creditWalletFromPayment` is idempotent via the `payments.credited` flag. `/api/wallet/topup/pix/:id/simulate-approve` only works when `MP_ACCESS_TOKEN` starts with `TEST-`.

Any route that spends credits (`/api/strategy/save`, `/api/backtest`, `/api/optimizer/genetic`) and `/api/forward/setup` now require `authMiddleware` — they 401 without a valid Supabase bearer token. The frontend keeps the token in `localStorage.fia_session` and the `api()` helper attaches it automatically.

### Data storage

Everything persists as JSON files under [data/](data/) — there is no SQL/NoSQL server:

- `data/db.json` — the main "database" (datasets metadata, backtests, mt5Status log, forwardTests, strategies, importConfig). Read via `db()` (sync `readFileSync` + `JSON.parse`) and written via `save(d)` on every mutation — treat each request handler as read-modify-write on the whole file, not a transaction. Users, balances and payments are **not** here — see the Supabase section above.
- `data/datasets/dataset_<PAIR>_<TIMEFRAME>.json` — one file per pair+timeframe holding the actual OHLCV candle array (deduped/sorted by `upsert()` in server.cjs).
- `data/robots/<id>/` and `data/projects/<id>/` — per-robot generated artifacts (robot.json, MQ5 export, validation results).
- `data/validation/<runId>*.json` — MT5 validation/platform-comparison run data.
- `data/runtime_v2/` — event/agent log for the v2 bridge (`agents.ndjson`, `events.ndjson`, `registry.json`, `snapshots/`).

### Two generations of MT5 integration (legacy vs v2)

This repo is mid-migration; both live side by side and Claude should not blend them:

1. **Legacy backtest/candle-ingest pipeline** (everything in `server.cjs` outside the v2 mount, e.g. `/api/mt5/candles`, `/api/mt5/status`, `/api/dataset*`, `/api/validation/*`, `/api/robots*`) — receives historical candles from MT5 bridge EAs ([mt5/ForexIA_Bridge_v25.mq5](mt5/ForexIA_Bridge_v25.mq5), `v26`), drives Smart Import/Datasets/Backtest Lab/Optimizer/Validation UI pages, and treats the frontend as allowed to matter for correctness (it's a research/backtesting tool).
2. **v2 production bridge** — [v2/mt5-production-bridge.cjs](v2/mt5-production-bridge.cjs), mounted into server.cjs at the bottom (`require('./v2/mt5-production-bridge.cjs')({app,dataDir,version,logger})`) and paired with [mt5/ForexIA_Production_Bridge_v2.mq5](mt5/ForexIA_Production_Bridge_v2.mq5). This is a **read-only monitoring bridge only** — signed/token-authenticated telemetry ingest (`x-agent-id`/`x-agent-ts`/`x-agent-signature` headers, HMAC-style `signWithToken`/`sha256` in the bridge file) for heartbeats, account/symbol/position/order snapshots, ticks, and closed candles. The EA is the sole source of truth for trading decisions and order execution — the backend/frontend must never be on the critical order path. Full design and the event/contract model are documented in [docs/mt5-v2-architecture.md](docs/mt5-v2-architecture.md); read it before touching anything under `v2/` or `mt5/*_v2*`.

### MQ5 files

Root-level `Robo_Recuperado_VALIDATION_v*.mq5`/`.ex5` files are generated/validation EA snapshots tied to specific robot export versions (compiled `.ex5` binaries are committed alongside source `.mq5`). `mt5/` holds the bridge EAs that talk to the backend. When asked to regenerate or bump a validation EA version, check `server.cjs` for the export/template logic (`/api/robot/export-mt5`, `/api/robots/:id/validation-mq5`) rather than hand-editing the `.mq5` — the backend generates these from the robot's strategy config.

### Frontend conventions (src/main.tsx)

- No build-time formatting/linting is enforced — the file is deliberately dense/minified-looking (single-line components, no whitespace) rather than idiomatic React formatting. Match the existing style rather than reformatting when making small edits.
- `Page` type + `Sidebar` item list define all top-level routes (dashboard, perfil, import, datasets, viewer, builder, robots, compare, lab, optimizer, validation, forward, voice, ranking, setup) — adding a page means extending both plus adding the render branch.
- All API calls go through the local `api()` helper (fetch + timeout + JSON-or-error parsing) — reuse it rather than calling `fetch` directly.
- UI strings and comments are in Portuguese (pt-BR); currency/number formatting uses `toLocaleString('pt-BR', ...)`. Keep new UI text consistent with this.

### WhatsApp / Evolution API

Optional local integration via [docker-compose.evolution.yml](docker-compose.evolution.yml) (Evolution API on port 8080). Config/instance creation/QR/status/logout/test-send endpoints live under `/api/whatsapp/*` and `/api/whatsapp/evolution/*` in server.cjs; secrets (`globalKey`, `instanceToken`) are masked in API responses (`'********'`) — never log or echo them unmasked.
