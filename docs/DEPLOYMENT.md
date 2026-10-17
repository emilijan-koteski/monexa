# Deployment

Monexa runs on the "Winterfell" VPS under [Dokploy](https://dokploy.monexa.world). Dokploy never clones or builds this repo: GitHub Actions builds the images, pushes them to GHCR and tells Dokploy which tag to run.

## Flow

```
git push master
   └─► GitHub Actions (.github/workflows/deploy.yml)
          ├─ test: go vet + route inventory check + go test, MCP typecheck + drift check + build, eslint + tsc
          │        (.github/workflows/ci.yml; PRs also run vite build)
          ├─ build backend image  ──► ghcr.io/emilijan-koteski/monexa-backend:{sha-<short>,latest}   (only if backend files changed)
          ├─ build frontend image ──► ghcr.io/emilijan-koteski/monexa-frontend:{sha-<short>,latest}  (only if frontend files changed)
          ├─ build MCP image      ──► ghcr.io/emilijan-koteski/monexa-mcp:{sha-<short>,latest}       (only if mcp-server/ or docs/api-routes.json changed)
          └─ deploy: Dokploy API  application.update {dockerImage: …:sha-<short>} → application.deploy
                 └─► Dokploy pulls the image and rolls the Swarm service
                        └─► Traefik: monexa.world → frontend:8080, api.monexa.world → backend:8080, mcp.monexa.world → mcp:8080
```

Images are `linux/amd64`. All three Dokploy services are *Application* services with provider **Docker** (registry `ghcr.io`). A tag `mcp-vX.Y.Z` runs a separate workflow ([Releasing the MCP server](#releasing-the-mcp-server)).

## Images

| Service  | Image                                      | Tags pushed per run           | Container port |
|----------|--------------------------------------------|-------------------------------|----------------|
| backend  | `ghcr.io/emilijan-koteski/monexa-backend`  | `sha-<7-char sha>`, `latest`  | `8080` (`PORT`) |
| frontend | `ghcr.io/emilijan-koteski/monexa-frontend` | `sha-<7-char sha>`, `latest`  | `8080`         |
| mcp      | `ghcr.io/emilijan-koteski/monexa-mcp`      | `sha-<7-char sha>`, `latest`; `v<X.Y.Z>` per `mcp-v*` release tag | `8080` (`PORT`) |

The MCP image is built from `mcp-server/` with its own build context, which is why the root `.dockerignore` excludes `mcp-server/` from the backend build. Its build stage uses TypeScript 7's native compiler; if `docker build mcp-server` fails on alpine because a binary is missing, pin `typescript` to `6.0.3` in `mcp-server/package.json`.

Dokploy is always pointed at the `sha-…` tag. Redeploying a floating tag such as `latest` re-pulls but does not roll the Swarm task on Dokploy 0.30.x ([Dokploy #5496](https://github.com/Dokploy/dokploy/issues/5496)); pinned tags also make rollbacks explicit.

## GitHub secrets

| Secret                    | Purpose |
|---------------------------|---------|
| `DOKPLOY_API_KEY`         | API token (Dokploy → profile → API tokens). Sent as `x-api-key`. |
| `DOKPLOY_BACKEND_APP_ID`  | `applicationId` of the backend application (from its URL in Dokploy, or `GET /api/project.all`). |
| `DOKPLOY_FRONTEND_APP_ID` | `applicationId` of the frontend application. |
| `DOKPLOY_MCP_APP_ID`      | `applicationId` of the MCP application. It must exist before the first push to `master` that changes `mcp-server/`: the deploy job fails on an empty value after the backend and frontend have already rolled. |

`GITHUB_TOKEN` (automatic, `packages: write`) pushes to GHCR.

## GitHub variables (not secret)

Settings → Secrets and variables → Actions → *Variables*:

| Variable | Value | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `https://api.monexa.world/api/v1` | Baked into the frontend image at build time. A missing value fails the build. |
| `VITE_LEGAL_COMPLIANCE_ENABLED` | `true` | Baked into the frontend image at build time. When the variable is unset the workflow passes `false`. Set it to `true` together with `LEGAL_COMPLIANCE_ENABLED` in Dokploy; the frontend treats anything but `false` as enabled. |
| `VITE_MCP_URL` | `https://mcp.monexa.world/mcp` | Optional. The MCP endpoint shown in the access token snippets of the web app, baked in at build time. Unset or empty falls back to `https://mcp.monexa.world/mcp`, so production does not need it; set it for a different domain. |

## Backend service — Dokploy Environment tab

| Variable | Required | Secret | Description |
|---|---|---|---|
| `DATABASE_URL` | yes | yes | `postgres://monexa_user:<password>@infrastructure-postgres-qopj51:5432/monexa_db?sslmode=disable`. `sslmode=disable` is intentional (same-host overlay). Percent-encode the password if it contains `@ / ? # %` or `:`. |
| `JWT_SECRET` | yes | yes | HMAC key for access/refresh tokens. A new value logs every session out. |
| `PPID_SECRET` | yes | yes | HMAC key that derives a user's pseudonymous ID at registration. Reuse the old server's value so new PPIDs stay consistent; existing PPIDs are stored, so a different value does not break logins. |
| `RESEND_API_KEY` | yes | yes | Resend API key for transactional email. |
| `RESEND_FROM_NAME` | yes | no | Sender display name, e.g. `Monexa`. |
| `RESEND_FROM_ADDRESS` | yes | no | Sender address on the verified Resend domain, e.g. `no-reply@monexa.world`. |
| `FRONTEND_URL` | yes | no | `https://monexa.world`. Used for links in emails. |
| `CORS_ORIGINS` | no | no | `https://monexa.world,https://www.monexa.world`. Unset allows any origin, which is only acceptable locally: always set it in production. |
| `EXCHANGE_RATE_API_KEY` | no | yes | exchangerate-api.com key for the daily rates job. Missing → the job logs an error and fallback rates are used. |
| `APP_ENV` | no | no | Must be `production` in production. Besides lowering GORM logging to warnings, it gates the one-time migration `20261016120000_lock_test_user_in_production`, which replaces the password of the seeded `test@monexa.com` account and ends its sessions, and a check at every start that locks the account the same way whenever its seeded password still works. Without it the account stays usable until the backend starts with `APP_ENV=production`. |
| `PORT` | no | no | Listen port, default `8080`. Must match the container port in the Domains tab. |
| `ACCESS_TOKEN_DURATION` | no | no | Go duration, default `168h`. |
| `REFRESH_TOKEN_DURATION` | no | no | Go duration, default `720h`. |
| `LEGAL_COMPLIANCE_ENABLED` | no | no | Set `true` in production (legal flow live since 16 October 2026) and keep it in sync with the `VITE_LEGAL_COMPLIANCE_ENABLED` repository variable. Any value other than `false`, including unset, enables the legal-acceptance flow. |
| `OAUTH_ISSUER_URL` | all four or none | no | `https://api.monexa.world`. The public origin of the backend, the OAuth issuer. No path and no trailing slash, a lowercase host and no default (`:443`, `:80`) or empty port; the backend names the canonical form when it is not. `http` is only accepted for loopback hosts. Must equal the MCP service's `MONEXA_OAUTH_ISSUER`. |
| `MCP_RESOURCE_URL` | all four or none | no | `https://mcp.monexa.world/mcp`, the public MCP endpoint and the audience of delegated tokens. Must already be normalized (lowercase host, no default port, no trailing slash); the backend names the normalized form when it is not. |
| `MCP_CLIENT_ID` | all four or none | no | Identifier of the MCP service's OAuth client, for example `monexa-mcp`. The same value goes on the MCP service. |
| `MCP_CLIENT_SECRET` | all four or none | yes | At least 32 characters; generate it with `openssl rand -hex 32`. The same value goes on the MCP service. |
| `OAUTH_ACCESS_TOKEN_TTL` | no | no | Go duration, default `1h`. |
| `OAUTH_REFRESH_TOKEN_TTL` | no | no | Go duration, default `2160h` (90 days). |

The four OAuth variables are all required or all absent: a partial set stops the backend at startup, and without them the backend registers no OAuth, consent or access token routes (the rest of the API is unaffected). The MCP service cannot start without them, because it reads the backend's OAuth metadata at startup.

The backend runs pending migrations at startup (gormigrate, `migrations` table), whether or not OAuth is configured. The restored production database held the first 16 migration IDs, the last being `20260404165500_add_token_family_to_sessions`. Every later migration runs on the first start of a build that contains it: the recurring expense tables and column, `20261016120000_lock_test_user_in_production`, and the four OAuth tables (`oauth_clients`, `oauth_grants`, `oauth_authorizations`, `oauth_tokens`). They add tables and constraints and replace the seeded test account's password, nothing else, so no manual step is needed.

If the lock migration was recorded while `APP_ENV` was not `production` (it logs "Skipped locking the seeded test account" and is still marked applied), no manual step is needed: every start with `APP_ENV=production` checks whether `test@monexa.com` still accepts its seeded password and, if it does, replaces the password, ends the account's sessions and logs "Re-locked the seeded test account". Keep `APP_ENV=production` set on the backend.

## Frontend service

No runtime environment variables. Values are baked in at build time by `deploy.yml`:

| Build arg | Value |
|---|---|
| `VITE_API_BASE_URL` | repository variable `VITE_API_BASE_URL` (see above) |
| `VITE_LEGAL_COMPLIANCE_ENABLED` | repository variable `VITE_LEGAL_COMPLIANCE_ENABLED` (see above), `false` when unset |
| `VITE_MCP_URL` | repository variable `VITE_MCP_URL` (optional, see above) |

nginx (`nginxinc/nginx-unprivileged`) listens on **8080** as a non-root user and serves the SPA with `index.html` fallback, gzip, `immutable` caching for `/assets/*` and `no-cache` for everything else. TLS is terminated by Traefik.

## MCP service — Dokploy Environment tab

The MCP service (`mcp-server/`) is a stateless Express app that serves the Streamable HTTP endpoint at `https://mcp.monexa.world/mcp`. It keeps no data and calls the backend over the Dokploy network. It refuses to start with a clear message when a variable is missing or malformed.

| Variable | Required | Secret | Description |
|---|---|---|---|
| `PORT` | no | no | `8080`. The image defaults to 8080; set it explicitly so it matches the container port in the Domains tab. |
| `MCP_PUBLIC_URL` | yes | no | `https://mcp.monexa.world`. Public origin without a path; the backend's `MCP_RESOURCE_URL` is this value plus `/mcp`. |
| `MONEXA_OAUTH_ISSUER` | yes | no | `https://api.monexa.world`. Must equal the backend's `OAUTH_ISSUER_URL` exactly: it is compared verbatim with the `issuer` in the backend's OAuth metadata, and a mismatch makes the service exit. |
| `MONEXA_API_URL` | yes | no | `http://<backend service name>:8080`, the backend's service (app) name as Dokploy generated it, reached over the Dokploy network. It is not the public URL, so token exchanges never pass through Cloudflare. |
| `MCP_CLIENT_ID` | yes | no | The same value as the backend. |
| `MCP_CLIENT_SECRET` | yes | yes | The same value as the backend, at least 32 characters. Generate it once with `openssl rand -hex 32`. Use hex only: RFC 6749 §2.3.1 sends the client credentials form-urlencoded in a Basic header, so a base64 `+`, `/` or `=` would need escaping. |
| `ALLOWED_HOSTS` | yes | no | `mcp.monexa.world`. Comma-separated hostnames accepted in the `Host` header; must include the `MCP_PUBLIC_URL` host. The image sets `NODE_ENV=production`, which makes it mandatory. |
| `OPENAI_APPS_CHALLENGE_TOKEN` | no | yes | The domain verification token from the ChatGPT app submission. Served at `/.well-known/openai-apps-challenge`; the route does not exist while it is unset. |

At startup the service fetches `${MONEXA_API_URL}/.well-known/oauth-authorization-server` up to 30 times, 2 seconds apart (about a minute), and exits with code 1 if the backend never answers or the issuer differs; Swarm then restarts it. Deploy the backend with the OAuth variables first.

### Setting up the MCP application

One time, before the first deploy that includes `mcp-server/`:

1. **Backend.** Generate the client secret, add the four OAuth variables to the backend (see above) and redeploy it. Check `curl https://api.monexa.world/.well-known/oauth-authorization-server`: it must return JSON whose `issuer` is `https://api.monexa.world`.
2. **Dokploy application.** In the same project as the other two, create an *Application* named `monexa-mcp` with provider **Docker**, image `ghcr.io/emilijan-koteski/monexa-mcp:latest` (CI replaces it with the `sha-…` tag on every deploy) and the same registry settings as the other applications. Fill in the Environment tab from the table above. In Domains add host `mcp.monexa.world`, path `/`, container port **8080**, HTTPS on, with the same certificate settings as the other domains. Optionally add the Swarm health check from [Health endpoints](#health-endpoints).
3. **GHCR visibility.** A new GHCR package is private at first. After the first push, give `monexa-mcp` the same visibility as the other two packages (package settings on GitHub), or Dokploy cannot pull it without credentials.
4. **GitHub secret.** Copy the application's `applicationId` (from its URL in Dokploy) into `DOKPLOY_MCP_APP_ID`.
5. **DNS and Cloudflare.** Add a proxied (orange cloud) DNS record for `mcp` pointing where `api` points, then add the rules in the next section.
6. **First deploy.** Merge, or run Actions → Deploy → *Run workflow* on `master`. Check `https://mcp.monexa.world/healthz` and add the connector in Claude (see [docs/MCP.md](MCP.md)).

### Cloudflare rules

Anthropic (egress range `160.79.104.0/21`) and OpenAI call `mcp.monexa.world`, `api.monexa.world/oauth/*` and `api.monexa.world/.well-known/*` from their own servers, with no browser and no cookies. A Cloudflare challenge on those paths shows up as a failed connection in the assistant and cannot be solved by anyone, so these paths must not be challenged.

- **WAF custom rule, action Skip.** Expression: `(http.host eq "mcp.monexa.world") or (http.host eq "api.monexa.world" and (starts_with(http.request.uri.path, "/oauth/") or starts_with(http.request.uri.path, "/.well-known/")))`. Skip the remaining custom rules, managed rules and, where the plan has it, Super Bot Fight Mode rules. Do not skip rate limiting rules.
- **Bot Fight Mode.** On the Free plan it is a zone-wide switch that ignores Skip rules. If it challenges these callers, add IP Access rules (Allow) for Anthropic's range, entered as `/24` entries because IP Access rules document `/24` and `/16` IPv4 ranges (`160.79.104.0/24` to `160.79.111.0/24`), plus OpenAI's published egress ranges, turn it off, or move to Super Bot Fight Mode, which does honour Skip rules.
- **Rate limiting rule for `mcp.monexa.world/mcp`, per IP.** Suggested: 300 requests per minute (plans that only offer a 10-second period need a proportionally smaller number). Every request with an `mnx_` bearer causes a token-exchange lookup at the backend, and the backend exempts the authenticated MCP client from its own rate limits, so this is the only throttle in front of it. Anthropic and OpenAI send all of their users' calls from a few shared addresses: keep the threshold generous or exclude those ranges from the rule.

To check, `curl -sS https://mcp.monexa.world/.well-known/oauth-protected-resource/mcp` and `curl -sS https://api.monexa.world/.well-known/oauth-authorization-server` from any machine must return JSON, not a "Just a moment…" page.

## Health endpoints

| Service  | Path              | Auth | Behaviour |
|----------|-------------------|------|-----------|
| backend  | `GET /healthz`    | none | Pings the database: `200` or `503`. `/api/v1/health` is the same handler. |
| frontend | `GET /health`     | none | `200 OK` from nginx. |
| mcp      | `GET /healthz`    | none | `200 {"status":"ok","version":…}` once the backend's OAuth metadata has loaded, `503` before. It skips host validation, so probes on `127.0.0.1` work. |

All three images declare a Docker `HEALTHCHECK` with busybox `wget`; the same command works in Dokploy's Swarm health-check settings:
`["CMD", "wget", "-qO-", "http://127.0.0.1:8080/healthz"]` (backend and mcp) and `…/health` (frontend). The MCP image allows a 90 s start period for the metadata retries.

The backend handles SIGTERM by draining in-flight requests for up to 10 s, which is what Swarm sends on every redeploy. The MCP service finishes in-flight requests on SIGTERM and exits `0`, or `1` after 8 s.

Client IPs (session records, legal acceptances, request logs) are taken from `X-Forwarded-For`, trusting private ranges (Traefik on the overlay) and Cloudflare's published edge ranges. This is only correct while Traefik's `forwardedHeaders.trustedIPs` is the Cloudflare list; with `forwardedHeaders.insecure: true` any client could spoof the header.

## Rolling back

1. Dokploy → application → Provider → Docker: set the image to an earlier `ghcr.io/emilijan-koteski/monexa-<service>:sha-<short>` and click Deploy. For the MCP service a release tag such as `ghcr.io/emilijan-koteski/monexa-mcp:v2.0.0` works as well. Every run's tag is in the Actions log ("Deploy requested for …") and in the GHCR package's tag list.
2. Or `git revert` the commit and push to `master`; the workflow builds and deploys the reverted state.

Migrations are forward-only; rolling back an image does not undo a migration. Rolling back the MCP image does not change its entry in the MCP Registry.

## Manual deploy

Actions → Deploy → *Run workflow* on `master` builds and deploys all three services regardless of what changed; a manual run on any other branch stops after the tests. Merging a PR into `master` deploys the changed services.

The deploy job returns as soon as Dokploy accepts the request ("Deploy requested for …"); the rollout itself is visible in the application's Deployments tab and in Dozzle.

## Alternative: deploy webhook

Each Dokploy application also has a deploy webhook URL (Deployments tab); `curl -fsS -X POST "$URL"` re-pulls the configured image and redeploys. Because of the floating-tag issue above it is only useful once the application already points at a fixed tag, so the workflow does not use it.

## Releasing the MCP server

Merging to `master` deploys the MCP service on its own (`sha-<short>` image, see above). Releasing is separate and does not touch Dokploy: bump `mcp-server/package.json`, `mcp-server/server.json` and the changelog, merge, then push the tag `mcp-vX.Y.Z` (details in [mcp-server/README.md](../mcp-server/README.md)). `.github/workflows/mcp-release.yml` then:

1. fails unless the tag version equals both `package.json` and `server.json`;
2. pushes `ghcr.io/emilijan-koteski/monexa-mcp:vX.Y.Z` and leaves `latest` alone;
3. publishes `server.json` to the MCP Registry as `io.github.emilijan-koteski/monexa` with `mcp-publisher login github-oidc`. No secret is involved: the workflow's OIDC token proves the repository owner.

The registry does not accept the same version twice, so a failed publish needs a new version. `mcp-publisher` is pinned to a release and verified against a SHA-256 in the workflow's `env`; update `MCP_PUBLISHER_VERSION` and `MCP_PUBLISHER_SHA256` together (the digest is shown on the release's asset list).

## One-time manual steps

- Deprecate the old stdio npm package once the hosted server is live, from an npm login that owns it. CI never runs this:

  ```bash
  npm deprecate monexa-mcp-server "Replaced by hosted connector https://mcp.monexa.world/mcp"
  ```

## Changing the domain

The backend and frontend read their hostnames from configuration; email links and the logo use `FRONTEND_URL`. To move to a new domain:

1. Dokploy → backend Environment: `FRONTEND_URL`, `CORS_ORIGINS`, `RESEND_FROM_ADDRESS` (verify the new domain in Resend first).
2. GitHub → Actions variables: `VITE_API_BASE_URL`.
3. Dokploy → Domains on all three applications, and the DNS records and Cloudflare rules for the API and MCP hostnames.
4. Actions → Deploy → *Run workflow* so the frontend is rebuilt with the new API URL and the backend restarts with the new variables.
5. The MCP and OAuth URLs must change together, or token exchange and discovery break:
   - Backend: `OAUTH_ISSUER_URL` and `MCP_RESOURCE_URL`.
   - MCP service: `MCP_PUBLIC_URL`, `MONEXA_OAUTH_ISSUER` and `ALLOWED_HOSTS`.
   - GitHub variable `VITE_MCP_URL` (and the default in `frontend/src/config/env.ts`).
   - `mcp-server/server.json` (`websiteUrl`, `icons`, `remotes`) plus a new `mcp-v…` release, since a published registry version is final. `docs/MCP.md` and `mcp-server/README.md` name the URL as well.

   Connectors people added at the old URL stop working; they have to add the new one.

## Local development

See the [README](../README.md). `docker compose --profile app up --build` runs the same backend and frontend Dockerfiles locally; the frontend is built with `VITE_MCP_URL=http://localhost:3001/mcp`. The MCP server runs on the host, see [mcp-server/README.md](../mcp-server/README.md#local-development).
