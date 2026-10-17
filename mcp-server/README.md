# Monexa MCP server

Remote [Model Context Protocol](https://modelcontextprotocol.io) server for [Monexa](https://monexa.world), served over Streamable HTTP at `https://mcp.monexa.world/mcp`. It lets AI assistants read and manage a user's records, categories, payment methods, recurring expenses, trend reports and settings.

This README is for developers and self-hosters. To connect an assistant, see the [user guide](../docs/MCP.md). The tools are listed in [TOOLS.md](TOOLS.md). Released under the MIT license.

## How it works

1. An AI app connects with a Monexa OAuth access token (`mnx_at_…`, obtained through the OAuth flow the backend serves) or a personal access token (`mnx_pat_…`) in `Authorization: Bearer`.
2. The server exchanges the bearer at the backend (RFC 8693, `POST /oauth/token`, authenticated as the MCP client) for a short-lived delegated JWT. Successful exchanges are cached in memory, keyed by a hash of the token, for at most 4 minutes, and tokens the backend rejects are answered from memory for 30 seconds.
3. Each tool call runs with that JWT against the Monexa REST API (`MONEXA_API_URL`). The backend only lets delegated tokens reach an allowlist of routes (`internal/middlewares/delegated_access.go`) and checks the `monexa.read` / `monexa.write` scope.
4. The server advertises the backend as its authorization server through protected resource metadata, so OAuth clients discover where to sign in. It mirrors the backend's metadata document, fetched at startup.
5. The server is stateless and keeps no user data. Every request builds its own MCP server instance.

## Environment

Set these on the service. The server refuses to start with a clear message when one is missing or malformed.

| Variable | Required | Must match backend | Description |
| --- | --- | --- | --- |
| `PORT` | No | | Listen port, default `8080`. |
| `MCP_PUBLIC_URL` | Yes | `MCP_RESOURCE_URL` (this value plus `/mcp`) | Public origin of this server, for example `https://mcp.monexa.world`. No path. `http` is only accepted for `localhost`, `127.0.0.1` and `[::1]`. |
| `MONEXA_OAUTH_ISSUER` | Yes | `OAUTH_ISSUER_URL` | Public OAuth issuer, for example `https://api.monexa.world`. A bare origin without trailing slash; it is compared verbatim with the `issuer` in the backend's metadata. |
| `MONEXA_API_URL` | Yes | | Backend base URL reachable from this service, for example `http://backend:8080`. Not necessarily public. |
| `MCP_CLIENT_ID` | Yes | `MCP_CLIENT_ID` | The OAuth client the backend recognizes for token exchange. |
| `MCP_CLIENT_SECRET` | Yes | `MCP_CLIENT_SECRET` | At least 32 characters. Generate it with `openssl rand -hex 32`. |
| `ALLOWED_HOSTS` | In production | | Comma-separated hostnames accepted in the `Host` header; must include the `MCP_PUBLIC_URL` host. Defaults to `localhost,127.0.0.1` outside production (`NODE_ENV=production` makes it required). |
| `OPENAI_APPS_CHALLENGE_TOKEN` | No | | Served as plain text at `/.well-known/openai-apps-challenge` for OpenAI domain verification; the route is absent when unset. |

The backend side of the same setup is `OAUTH_ISSUER_URL`, `MCP_RESOURCE_URL`, `MCP_CLIENT_ID` and `MCP_CLIENT_SECRET`, optionally `OAUTH_ACCESS_TOKEN_TTL` (default `1h`) and `OAUTH_REFRESH_TOKEN_TTL` (default `2160h`). The backend needs all four or none, and serves no OAuth routes without them. Deployment details are in [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md).

## Routes

| Route | Description |
| --- | --- |
| `POST /mcp` | The MCP endpoint. A bearer token is required. |
| `GET /.well-known/oauth-protected-resource/mcp` | Protected resource metadata. |
| `GET /.well-known/oauth-authorization-server` | Mirror of the backend's authorization server metadata. |
| `GET /.well-known/openai-apps-challenge` | OpenAI domain verification token, when configured. |
| `GET /healthz` | `200 {"status":"ok","version":…}` once the backend's metadata has loaded, `503` before. It is not subject to host validation, so container probes on `127.0.0.1` work. |
| `GET /icon.svg`, `GET /icon.png` | The Monexa icon advertised in `serverInfo.icons`. |

Until the backend's metadata has loaded, every route except `/healthz` answers `503` with `Retry-After`. At startup the server fetches `${MONEXA_API_URL}/.well-known/oauth-authorization-server` up to 30 times, 2 seconds apart, and exits with code 1 if it never succeeds or if the `issuer` differs from `MONEXA_OAUTH_ISSUER`. A backend outage or a rejected client secret reaches clients as `503`, never `401`, so they do not fall into a re-authentication loop.

## Local development

Requires Node 22 and a running backend with OAuth enabled. Start the backend with

```bash
OAUTH_ISSUER_URL=http://localhost:9000
MCP_RESOURCE_URL=http://localhost:3001/mcp
MCP_CLIENT_ID=monexa-mcp
MCP_CLIENT_SECRET=<at least 32 characters>
```

in its environment, then run the MCP server with the same client credentials. `npm run dev` loads `mcp-server/.env` when it exists (git-ignored), so put them there:

```bash
PORT=3001
MCP_PUBLIC_URL=http://localhost:3001
MONEXA_OAUTH_ISSUER=http://localhost:9000
MONEXA_API_URL=http://localhost:9000
MCP_CLIENT_ID=monexa-mcp
MCP_CLIENT_SECRET=<same secret as the backend>
```

```bash
cd mcp-server
npm install
npm run dev
```

Point the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) (`npx @modelcontextprotocol/inspector`) at `http://localhost:3001/mcp` and sign in through OAuth, or paste a personal access token created in the web app under Settings, Connected apps.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Runs `src/index.ts` with `tsx watch`. |
| `npm run build` | Compiles `src` to `dist/` with `tsc -p tsconfig.build.json`. |
| `npm start` | Runs the compiled server, `node dist/index.js`. |
| `npm run typecheck` | `tsc --noEmit` over `src`, `scripts` and `test`. |
| `npm run check` | The drift guard, described below. |
| `npm run docs` | Regenerates [TOOLS.md](TOOLS.md) from the tool registry. |
| `npm test` | Runs the vitest suite in `test/`. Tests are local-only by project policy: they are never committed and CI does not run them. |

### The drift guard

`npm run check` exits 1 with readable messages unless all of these hold:

- Every route in [`../docs/api-routes.json`](../docs/api-routes.json) (the backend's route inventory, written by `go run ./cmd/routes -write`) is covered by exactly one tool's `covers` list or listed in `src/tools/excluded.ts` with a reason, and every `covers` or excluded entry exists in the inventory.
- Every route a tool covers is marked `"delegated": true` in the inventory, which means the backend allowlist in `internal/middlewares/delegated_access.go` lets connected apps call it.
- Tool names are unique snake_case of at most 64 characters, and each tool has a title and the four annotation hints, with `openWorldHint: false`.
- Tools with `readOnlyHint: true` cover only `GET` routes.
- `TOOLS.md` equals what `npm run docs` generates.
- `server.json` has the same `version` as `package.json` and a description of at most 100 characters.

When the backend gains a route or its delegated allowlist changes, `go run ./cmd/routes -check` fails first. Run it with `-write`, then add a tool that covers the route or an entry in `excluded.ts`, run `npm run docs`, and commit the results together.

## Tools

22 tools cover 24 of the backend's 65 API routes; the other 41 are intentionally excluded, such as sign-in, session and account-security routes, OAuth endpoints, legal documents, data export and trend report editing (see `src/tools/excluded.ts` and the end of [TOOLS.md](TOOLS.md)). Tool names are snake_case, input names are camelCase (for example `includeDetails`), and inputs are validated with zod before any API call. Every tool declares `title`, `readOnlyHint`, `destructiveHint`, `idempotentHint` and `openWorldHint: false`, and returns both `structuredContent` and a JSON text block.

## Operations

- **Logging.** One JSON line per `/mcp` request with the HTTP and JSON-RPC method, tool name, status, duration in milliseconds and the OAuth client ID. Tokens and tool arguments are never logged.
- **Shutdown.** On `SIGTERM` or `SIGINT` the server stops accepting connections and lets in-flight requests finish. It exits `0` when they are done and forces exit `1` after 8 seconds.
- **Container.** The [Dockerfile](Dockerfile) builds a `node:22-alpine` image that runs as a non-root user and probes `/healthz`; the start period allows for the metadata retries.

## Versioning and releases

The version in `package.json` follows [SemVer](https://semver.org); `server.json` must carry the same version, and `npm run check` enforces it.

- **Major**: a tool is removed or renamed, or a tool's schema changes incompatibly.
- **Minor**: a new tool or a new optional parameter.
- **Patch**: fixes with no schema change.

Record changes under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md) ([Keep a Changelog](https://keepachangelog.com)) and move them under the new version heading when releasing. Set a new tool's `since` to the version that introduces it.

To release, bump `package.json`, `server.json` and the changelog, merge to `master`, then push the tag `mcp-vX.Y.Z` (for example `git tag mcp-v2.0.0 && git push origin mcp-v2.0.0`). CI pushes the image `ghcr.io/emilijan-koteski/monexa-mcp:vX.Y.Z` and publishes `server.json` to the [official MCP Registry](https://registry.modelcontextprotocol.io) as `io.github.emilijan-koteski/monexa`. Merging to `master` deploys the `sha-<short>` image to production independently of tags.

## Support

Questions and bug reports: [emilijankoteski@pm.me](mailto:emilijankoteski@pm.me) or an issue on [GitHub](https://github.com/emilijan-koteski/monexa/issues).
