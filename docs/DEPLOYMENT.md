# Deployment

Monexa runs on the "Winterfell" VPS under [Dokploy](https://dokploy.monexa.world). Dokploy never clones or builds this repo: GitHub Actions builds the images, pushes them to GHCR and tells Dokploy which tag to run.

## Flow

```
git push master
   └─► GitHub Actions (.github/workflows/deploy.yml)
          ├─ test: go vet + go test, eslint + vite build   (.github/workflows/ci.yml)
          ├─ build backend image  ──► ghcr.io/emilijan-koteski/monexa-backend:{sha-<short>,latest}   (only if backend files changed)
          ├─ build frontend image ──► ghcr.io/emilijan-koteski/monexa-frontend:{sha-<short>,latest}  (only if frontend files changed)
          └─ deploy: Dokploy API  application.update {dockerImage: …:sha-<short>} → application.deploy
                 └─► Dokploy pulls the image and rolls the Swarm service
                        └─► Traefik: monexa.world → frontend:8080, api.monexa.world → backend:8080
```

Images are `linux/amd64`. Both Dokploy services are *Application* services with provider **Docker** (registry `ghcr.io`).

## Images

| Service  | Image                                      | Tags pushed per run           | Container port |
|----------|--------------------------------------------|-------------------------------|----------------|
| backend  | `ghcr.io/emilijan-koteski/monexa-backend`  | `sha-<7-char sha>`, `latest`  | `8080` (`PORT`) |
| frontend | `ghcr.io/emilijan-koteski/monexa-frontend` | `sha-<7-char sha>`, `latest`  | `8080`         |

Dokploy is always pointed at the `sha-…` tag. Redeploying a floating tag such as `latest` re-pulls but does not roll the Swarm task on Dokploy 0.30.x ([Dokploy #5496](https://github.com/Dokploy/dokploy/issues/5496)); pinned tags also make rollbacks explicit.

## GitHub secrets

| Secret                    | Purpose |
|---------------------------|---------|
| `DOKPLOY_API_KEY`         | API token (Dokploy → profile → API tokens). Sent as `x-api-key`. |
| `DOKPLOY_BACKEND_APP_ID`  | `applicationId` of the backend application (from its URL in Dokploy, or `GET /api/project.all`). |
| `DOKPLOY_FRONTEND_APP_ID` | `applicationId` of the frontend application. |

`GITHUB_TOKEN` (automatic, `packages: write`) pushes to GHCR. Nothing else in CI is secret; the frontend build args below are plain values in the workflow.

## Backend service — Dokploy Environment tab

| Variable | Required | Secret | Description |
|---|---|---|---|
| `DATABASE_URL` | yes | yes | `postgres://monexa_user:<password>@infrastructure-postgres-qopj51:5432/monexa_db?sslmode=disable`. `sslmode=disable` is intentional (same-host overlay). |
| `JWT_SECRET` | yes | yes | HMAC key for access/refresh tokens. A new value logs every session out. |
| `PPID_SECRET` | yes | yes | HMAC key that derives a user's pseudonymous ID at registration. Reuse the old server's value so new PPIDs stay consistent; existing PPIDs are stored, so a different value does not break logins. |
| `RESEND_API_KEY` | yes | yes | Resend API key for transactional email. |
| `RESEND_FROM_NAME` | yes | no | Sender display name, e.g. `Monexa`. |
| `RESEND_FROM_ADDRESS` | yes | no | Sender address on the verified Resend domain, e.g. `no-reply@monexa.world`. |
| `FRONTEND_URL` | yes | no | `https://monexa.world`. Used for links in emails. |
| `CORS_ORIGINS` | yes | no | `https://monexa.world,https://www.monexa.world`. Unset allows any origin (local dev only). |
| `EXCHANGE_RATE_API_KEY` | yes | yes | exchangerate-api.com key for the daily rates job. Missing → the job logs an error and fallback rates are used. |
| `APP_ENV` | no | no | `production` lowers GORM logging to warnings. |
| `PORT` | no | no | Listen port, default `8080`. Must match the container port in the Domains tab. |
| `ACCESS_TOKEN_DURATION` | no | no | Go duration, default `168h`. |
| `REFRESH_TOKEN_DURATION` | no | no | Go duration, default `720h`. |
| `LEGAL_COMPLIANCE_ENABLED` | no | no | Set `false` (the previous production value). Any other value, including unset, enables the legal-acceptance flow. |

The backend runs pending migrations at startup (gormigrate, `migrations` table). The restored production database already holds all 15 migration IDs, the last being `20260404165500_add_token_family_to_sessions`, so the first start changes nothing.

## Frontend service

No runtime environment variables. Values are baked in at build time by `deploy.yml`:

| Build arg | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://api.monexa.world/api/v1` |
| `VITE_LEGAL_COMPLIANCE_ENABLED` | `false` |

nginx (`nginxinc/nginx-unprivileged`) listens on **8080** as a non-root user and serves the SPA with `index.html` fallback, gzip, `immutable` caching for `/assets/*` and `no-cache` for everything else. TLS is terminated by Traefik.

## Health endpoints

| Service  | Path              | Auth | Behaviour |
|----------|-------------------|------|-----------|
| backend  | `GET /healthz`    | none | Pings the database: `200` or `503`. `/api/v1/health` is the same handler. |
| frontend | `GET /health`     | none | `200 OK` from nginx. |

Both images declare a Docker `HEALTHCHECK` with busybox `wget`; the same command works in Dokploy's Swarm health-check settings:
`["CMD", "wget", "-qO-", "http://127.0.0.1:8080/healthz"]` (backend) and `…/health` (frontend).

The backend handles SIGTERM by draining in-flight requests for up to 10 s, which is what Swarm sends on every redeploy.

## Rolling back

1. Dokploy → application → Provider → Docker: set the image to an earlier `ghcr.io/emilijan-koteski/monexa-<service>:sha-<short>` and click Deploy. Every run's tag is in the Actions log ("Deploy requested for …") and in the GHCR package's tag list.
2. Or `git revert` the commit and push to `master`; the workflow builds and deploys the reverted state.

Migrations are forward-only; rolling back an image does not undo a migration.

## Manual deploy

Actions → Deploy → *Run workflow* builds and deploys both services from `master` regardless of what changed. Merging a PR into `master` does the same for the changed halves.

## Alternative: deploy webhook

Each Dokploy application also has a deploy webhook URL (Deployments tab); `curl -fsS -X POST "$URL"` re-pulls the configured image and redeploys. Because of the floating-tag issue above it is only useful once the application already points at a fixed tag, so the workflow does not use it.

## Local development

See the [README](../README.md). `docker compose --profile app up --build` runs the same two Dockerfiles locally.
