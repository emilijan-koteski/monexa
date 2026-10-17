# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Monexa is a personal finance / expense tracker with multi-currency support. The repo is a monorepo with three independently-built parts that all speak the same REST API:

- **Backend** (`cmd/`, `internal/`) — Go 1.25, Echo HTTP framework, GORM + PostgreSQL.
- **Frontend** (`frontend/`) — React 19 + Vite + TypeScript, MUI v7, TanStack Query.
- **MCP server** (`mcp-server/`) — remote MCP service (Express, Streamable HTTP at `https://mcp.monexa.world/mcp`) that exposes the API to AI assistants; it is an API *client* of the backend, deployed as its own Dokploy service.

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
go run ./cmd/routes -write                 # regenerate docs/api-routes.json after adding/removing routes (CI runs -check)

# Frontend — http://localhost:5173
cd frontend && npm ci && npm run dev
npm run lint                               # eslint — the only frontend gate (no unit tests)
npm run build                              # tsc -b && vite build

# MCP server — needs a backend with OAuth configured (mcp-server/README.md)
cd mcp-server && npm ci && npm run dev        # tsx watch src/index.ts
npm run typecheck                             # tsc --noEmit
npm run check                                 # drift guard vs docs/api-routes.json (CI runs it)
npm run docs                                  # regenerate TOOLS.md
npm run build                                 # tsc -p tsconfig.build.json

# Whole app in Docker (same images as production) — UI on :3000, API on :9000
docker compose --profile app up --build
```

Env setup: `cp .env.example .env` and `cp frontend/.env.example frontend/.env` (example values work locally). `RequiredEnv` in [internal/server/config.go](internal/server/config.go) lists the vars the backend refuses to start without.

## Backend architecture

Strict one-directional layering: **handler → service → GORM model**. Do not skip layers or put DB access in handlers.

- **Wiring is manual and centralized.** [cmd/api/main.go](cmd/api/main.go) constructs every client, service, and job by hand and threads dependencies in. There is no DI container — adding a service means wiring it here, and construction order matters (services depend on earlier ones). All route registration lives in `routes.Register` ([internal/routes/routes.go](internal/routes/routes.go), fed by a `Deps` struct), which `cmd/routes` reuses to build the route inventory — register new handlers there, not in `main`.
- **Handlers** (`internal/handlers/`) bind the request, pull `claims` via `middlewares.GetUserClaims`, enforce ownership (`service.IsOwner(...)` → `responses.Unauthorized`), then delegate to the service. Each handler file has a `RegisterXHandler(e, service, restrictedMiddlewares...)` that defines its route group.
- **Responses are a fixed envelope.** Always return via the helpers in [internal/handlers/responses/responses.go](internal/handlers/responses/responses.go) (`SuccessWithData`, `FailureWithError`, `NotFound`, `Unauthorized`, `LegalAcceptanceRequired`, …). The JSON shape is `{status, data}` / `{status, message}` / `{status, error}`. Frontend and MCP client both unwrap `result.data`.
- **Request/response shapes** live in `internal/requests/` and `internal/responses/`; enums are Go types in `internal/models/types/`.
- **Migrations** ([internal/database/migrations.go](internal/database/migrations.go)) are a gormigrate slice run automatically at startup. Order is defined by **slice position, not by the timestamp ID** (e.g. `add_test_user` deliberately sits after later-dated migrations because it depends on seeded tables). **Append new migrations to the end of the slice**, each with a `Migrate` and `Rollback`. Migrations are forward-only in production.
- **Auth** uses `echo-jwt` with HMAC (`JWT_SECRET`). Access + refresh tokens with a rotating `token_family` (see `sessions`). `UserClaims` carry `UserID`, `TokenType`, and `LegalAcceptedAt`.
- **OAuth for AI apps** is an authorization server inside the backend (`/oauth/*`, `/.well-known/oauth-authorization-server`, consent and connected-app routes, personal access tokens `mnx_pat_…`). It exists only when `OAUTH_ISSUER_URL`, `MCP_RESOURCE_URL`, `MCP_CLIENT_ID` and `MCP_CLIENT_SECRET` are all set; a partial set is a startup error (`internal/server/oauth_config.go`). The MCP service exchanges an OAuth access token or PAT for a 5-minute delegated JWT (RFC 8693) and calls the normal REST API with it. `delegatedAccessGuard` in [internal/middlewares/delegated_access.go](internal/middlewares/delegated_access.go) lets delegated tokens reach only an allowlist of routes (and `monexa.read` / `monexa.write` scopes) — **a new REST route is denied to AI agents until it is added to that allowlist.**
- **Legal compliance is feature-flagged** via `LEGAL_COMPLIANCE_ENABLED`. When enabled, `LegalComplianceMiddleware` returns HTTP **451** if the user hasn't accepted the latest effective documents, and the legal routes/handlers are only registered then. `restrictedMiddlewares` is the slice threaded into every protected handler so the flag toggles behavior app-wide.
- **Multi-currency**: `CurrencyService` + the `exchange_rates` table. A daily job fetches rates from exchangerate-api.com (`EXCHANGE_RATE_API_KEY`); `FALLBACK`-source rates seeded via migrations are used when the key/API is missing.
- **Background jobs** (`internal/jobs/`) are ticker loops started in `main` (session cleanup, exchange-rate update, reset-token cleanup, account deletion, recurring-expense generation, OAuth cleanup) — all 24h.
- **PPID** is a pseudonymous per-user ID derived as `HMAC(PPID_SECRET, userID)` at registration (`internal/utils/ppid.go`). Reuse the secret across environments to keep IDs stable.
- Client IPs come from `X-Forwarded-For`, trusting Traefik/Cloudflare ranges (`internal/server/ip.go`); the server drains in-flight requests on SIGTERM.

## Frontend architecture

- **API access** goes through [frontend/src/api/apiClient.ts](frontend/src/api/apiClient.ts), a `fetch` wrapper that proactively refreshes the access token when it's close to expiry, retries once on 401, queues concurrent requests during a refresh, and redirects to `/legal-acceptance` on a 451. Auth endpoints bypass it.
- **Data layer** is TanStack Query. Each `src/services/*.ts` exports both raw API functions and the `useQuery`/`useMutation` hooks plus its query keys. Services import each other's query keys to invalidate across domains (e.g. `recordService` invalidates `trendReportQueryKeys`) — keep those cross-invalidations in mind when adding mutations.
- **Config** is `src/config/env.ts` reading `import.meta.env.VITE_*` (`VITE_API_BASE_URL`, `VITE_LEGAL_COMPLIANCE_ENABLED`, optional `VITE_MCP_URL`). These are baked in at build time.
- **Routing** ([frontend/src/routes/routes.tsx](frontend/src/routes/routes.tsx)) uses lazy-loaded pages with `ProtectedRoute` / `AuthRoute` wrappers; legal routes are conditional on the compliance flag.
- Conventions: one folder per component/page with a co-located `.scss`; forms use `react-hook-form` + `zod`; i18n via `i18next` with `src/locales/{en,mk}.json`; shared enums in `src/enums/`, types in `src/types/`.

## MCP server architecture

A stateless remote service (Express + MCP TypeScript SDK v2, Streamable HTTP) served at `https://mcp.monexa.world/mcp`. It is an API client of the backend, not part of it, and keeps no user data. See [mcp-server/README.md](mcp-server/README.md) for developers and [docs/MCP.md](docs/MCP.md) for users.

- **Auth.** Clients send an OAuth access token (`mnx_at_…`) or a personal access token (`mnx_pat_…`) as a bearer. The server exchanges it at the backend (RFC 8693, `POST /oauth/token`, authenticated as the MCP client with `MCP_CLIENT_ID`/`MCP_CLIENT_SECRET`) for a 5-minute delegated JWT, caches the result briefly in memory, and uses it for the REST calls. It publishes protected resource metadata that points clients at the backend as the authorization server.
- **Config** is validated at startup in [mcp-server/src/config.ts](mcp-server/src/config.ts). Its URLs and client credentials must match the backend's OAuth variables; the tables are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
- **Tools** live in `mcp-server/src/tools/*`, one file per domain, registered through [mcp-server/src/tools/index.ts](mcp-server/src/tools/index.ts). Each tool lists the backend routes it calls in `covers`; routes that are deliberately not exposed are listed with a reason in `src/tools/excluded.ts`. `TOOLS.md` is generated from the registry.
- **Drift guard.** `npm run check` fails unless every route in `docs/api-routes.json` is covered by exactly one tool or excluded, tool metadata is complete, `TOOLS.md` is current and `server.json` matches `package.json`. After adding or removing a backend route: `go run ./cmd/routes -write`, add a tool or an `excluded.ts` entry, allow the route for delegated tokens if a tool needs it, `npm run docs`, and commit them together.
- **Versioning.** SemVer in `package.json` (mirrored in `server.json`), changes under `Unreleased` in `CHANGELOG.md`. Pushing the tag `mcp-vX.Y.Z` runs `mcp-release.yml`, which pushes the versioned image and publishes `server.json` to the MCP Registry; merging to `master` deploys independently.

## Comments

A PreToolUse hook (`.claude/hooks/comment_policy.py`) rejects new comments that break this rule, and a Stop hook re-checks uncommitted changes:

- Allowed: a doc comment of one or two short sentences, at most three lines, directly above a function, method or top-level type. Tool directives (`//go:`, `//nolint`, `eslint-disable`, `@ts-expect-error`) are fine.
- Not allowed: comments inside function bodies, between struct, interface, object or JSX members, at the end of a line, above test blocks, section banners, and ticket references.
- Express intent through names, small functions and named constants instead.
- Audit any path with `python3 .claude/hooks/comment_policy.py audit --lines <path>`. Use `/clean-comments <path>` to clean an area.

## Tests are temporary

Write tests freely while developing to check your work. They may be committed locally while a feature spans several commits, but must be deleted before pushing. Test files the branch adds (`*_test.go`, `*.test.ts(x)`, `*.spec.ts(x)`, `__tests__/`, `testutil/`, `testdata/`) must not reach the remote; tests that already exist on `master` are fine, and tests committed then removed on the branch pass.

- [.claude/hooks/test_files_policy.py](.claude/hooks/test_files_policy.py) runs only for `git push` (via the hook's `if` filter), blocks it when the branch adds test files compared to `origin/master`, and rejects `--no-verify`. Commits are never blocked.
- The same script runs as a git `pre-push` hook from `.githooks/`. Enable it once per clone with `git config core.hooksPath .githooks`.
- Check manually with `python3 .claude/hooks/test_files_policy.py check`.

## CI & deployment

- CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) on PRs to `master`: `go vet` + `go run ./cmd/routes -check` + `go test -race`, MCP server `typecheck` + `check` + `build`, and frontend `eslint` + `vite build`.
- Deploys are image-based: pushing/merging to `master` builds backend/frontend/MCP images, pushes them to GHCR with a pinned `sha-<short>` tag, and calls the Dokploy API to roll the services (only the changed services rebuild). Dokploy never builds from source. Full details, env-var tables, MCP service and Cloudflare setup, and rollback steps are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
