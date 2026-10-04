# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Monexa is a personal finance / expense tracker with multi-currency support. The repo is a monorepo with three independently-built parts that all speak the same REST API:

- **Backend** (`cmd/`, `internal/`) — Go 1.25, Echo HTTP framework, GORM + PostgreSQL.
- **Frontend** (`frontend/`) — React 19 + Vite + TypeScript, MUI v7, TanStack Query.
- **MCP server** (`mcp-server/`) — standalone npm package (`monexa-mcp-server`) that exposes the API to AI assistants over stdio; it is an API *client*, not part of the backend.

Tool versions come from `mise.toml` (Go 1.25, Node 22); run `mise install`. Supported currencies are `MKD, EUR, USD, AUD, CHF, GBP`; supported languages are `EN, MK` (English/Macedonian).

## Commands

Database (required for backend) runs in Docker; backend and frontend run on the host for hot reload.

```bash
# Database — Postgres on localhost:5433 (postgres/postgres, db "monexa")
docker compose up -d

# Backend — http://localhost:9000, runs migrations on startup
go run ./cmd/api
go vet ./...
go test ./...                              # all tests
go test -race ./...                        # what CI runs
go test -run TestName ./internal/server/   # a single test

# Frontend — http://localhost:5173
cd frontend && npm ci && npm run dev
npm run lint                               # eslint — the only frontend gate (no unit tests)
npm run build                              # tsc -b && vite build

# MCP server
cd mcp-server && npm install && npm run dev   # tsx src/index.ts
npm run build                                 # tsc

# Whole app in Docker (same images as production) — UI on :3000, API on :9000
docker compose --profile app up --build
```

Env setup: `cp .env.example .env` and `cp frontend/.env.example frontend/.env` (example values work locally). `RequiredEnv` in [internal/server/config.go](internal/server/config.go) lists the vars the backend refuses to start without.

## Backend architecture

Strict one-directional layering: **handler → service → GORM model**. Do not skip layers or put DB access in handlers.

- **Wiring is manual and centralized.** [cmd/api/main.go](cmd/api/main.go) constructs every client, service, job, and handler by hand and threads dependencies in. There is no DI container — adding a service means wiring it here, and construction order matters (services depend on earlier ones).
- **Handlers** (`internal/handlers/`) bind the request, pull `claims` via `middlewares.GetUserClaims`, enforce ownership (`service.IsOwner(...)` → `responses.Unauthorized`), then delegate to the service. Each handler file has a `RegisterXHandler(e, service, restrictedMiddlewares...)` that defines its route group.
- **Responses are a fixed envelope.** Always return via the helpers in [internal/handlers/responses/responses.go](internal/handlers/responses/responses.go) (`SuccessWithData`, `FailureWithError`, `NotFound`, `Unauthorized`, `LegalAcceptanceRequired`, …). The JSON shape is `{status, data}` / `{status, message}` / `{status, error}`. Frontend and MCP client both unwrap `result.data`.
- **Request/response shapes** live in `internal/requests/` and `internal/responses/`; enums are Go types in `internal/models/types/`.
- **Migrations** ([internal/database/migrations.go](internal/database/migrations.go)) are a gormigrate slice run automatically at startup. Order is defined by **slice position, not by the timestamp ID** (e.g. `add_test_user` deliberately sits after later-dated migrations because it depends on seeded tables). **Append new migrations to the end of the slice**, each with a `Migrate` and `Rollback`. Migrations are forward-only in production.
- **Auth** uses `echo-jwt` with HMAC (`JWT_SECRET`). Access + refresh tokens with a rotating `token_family` (see `sessions`). `UserClaims` carry `UserID`, `TokenType`, and `LegalAcceptedAt`.
- **Legal compliance is feature-flagged** via `LEGAL_COMPLIANCE_ENABLED`. When enabled, `LegalComplianceMiddleware` returns HTTP **451** if the user hasn't accepted the latest effective documents, and the legal routes/handlers are only registered then. `restrictedMiddlewares` is the slice threaded into every protected handler so the flag toggles behavior app-wide.
- **Multi-currency**: `CurrencyService` + the `exchange_rates` table. A daily job fetches rates from exchangerate-api.com (`EXCHANGE_RATE_API_KEY`); `FALLBACK`-source rates seeded via migrations are used when the key/API is missing.
- **Background jobs** (`internal/jobs/`) are ticker loops started in `main` (session cleanup, exchange-rate update, reset-token cleanup, account deletion) — all 24h.
- **PPID** is a pseudonymous per-user ID derived as `HMAC(PPID_SECRET, userID)` at registration (`internal/utils/ppid.go`). Reuse the secret across environments to keep IDs stable.
- Client IPs come from `X-Forwarded-For`, trusting Traefik/Cloudflare ranges (`internal/server/ip.go`); the server drains in-flight requests on SIGTERM.

## Frontend architecture

- **API access** goes through [frontend/src/api/apiClient.ts](frontend/src/api/apiClient.ts), a `fetch` wrapper that proactively refreshes the access token when it's close to expiry, retries once on 401, queues concurrent requests during a refresh, and redirects to `/legal-acceptance` on a 451. Auth endpoints bypass it.
- **Data layer** is TanStack Query. Each `src/services/*.ts` exports both raw API functions and the `useQuery`/`useMutation` hooks plus its query keys. Services import each other's query keys to invalidate across domains (e.g. `recordService` invalidates `trendReportQueryKeys`) — keep those cross-invalidations in mind when adding mutations.
- **Config** is `src/config/env.ts` reading `import.meta.env.VITE_*` (`VITE_API_BASE_URL`, `VITE_LEGAL_COMPLIANCE_ENABLED`). These are baked in at build time.
- **Routing** ([frontend/src/routes/routes.tsx](frontend/src/routes/routes.tsx)) uses lazy-loaded pages with `ProtectedRoute` / `AuthRoute` wrappers; legal routes are conditional on the compliance flag.
- Conventions: one folder per component/page with a co-located `.scss`; forms use `react-hook-form` + `zod`; i18n via `i18next` with `src/locales/{en,mk}.json`; shared enums in `src/enums/`, types in `src/types/`.

## MCP server architecture

Standalone package that re-implements an API client against the same backend (`@modelcontextprotocol/sdk`, stdio transport). Tools are grouped per domain in `mcp-server/src/tools/*` and registered through `registerAllTools` ([mcp-server/src/tools/index.ts](mcp-server/src/tools/index.ts)). Auth (`src/auth.ts`) keeps token state in memory and mirrors the frontend's refresh logic; optional `MONEXA_EMAIL`/`MONEXA_PASSWORD` auto-login at startup, otherwise the `login`/`register` tools authenticate. The published default API URL lives in [mcp-server/src/config.ts](mcp-server/src/config.ts) (override with `MONEXA_API_BASE_URL`).

## CI & deployment

- CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) on PRs to `master`: `go vet` + `go test -race`, and frontend `eslint` + `vite build`. The MCP server is not in CI.
- Deploys are image-based: pushing/merging to `master` builds backend/frontend images, pushes them to GHCR with a pinned `sha-<short>` tag, and calls the Dokploy API to roll the services (only the changed half rebuilds). Dokploy never builds from source. Full details, env-var tables, and rollback steps are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
