# Monexa MCP server

Remote [Model Context Protocol](https://modelcontextprotocol.io) server for [Monexa](https://monexa.world), served over Streamable HTTP at `https://mcp.monexa.world/mcp`.

AI apps authenticate with a Monexa OAuth access token (`mnx_at_…`) or a personal access token (`mnx_pat_…`). The server exchanges that token at the backend (RFC 8693, `POST /oauth/token` with the MCP client credentials) for a short-lived delegated JWT and calls the Monexa REST API with it. It runs as its own Docker service next to the backend.

## Environment

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | Listen port, default `8080`. |
| `MCP_PUBLIC_URL` | Yes | Public origin of this server, e.g. `https://mcp.monexa.world`. The MCP resource is `${MCP_PUBLIC_URL}/mcp` and must equal the backend's `MCP_RESOURCE_URL`. |
| `MONEXA_OAUTH_ISSUER` | Yes | Public OAuth issuer, e.g. `https://api.monexa.world`. Must equal the backend's `OAUTH_ISSUER_URL`. |
| `MONEXA_API_URL` | Yes | Backend base URL on the internal network, e.g. `http://backend:8080`. |
| `MCP_CLIENT_ID` | Yes | Must equal the backend's `MCP_CLIENT_ID`. |
| `MCP_CLIENT_SECRET` | Yes | Must equal the backend's `MCP_CLIENT_SECRET` (at least 32 characters). |
| `ALLOWED_HOSTS` | In production | Comma-separated hostnames accepted in the `Host` header; must include the `MCP_PUBLIC_URL` host. Defaults to `localhost,127.0.0.1` outside production. |
| `OPENAI_APPS_CHALLENGE_TOKEN` | No | Served at `/.well-known/openai-apps-challenge` for OpenAI domain verification. |

## Routes

- `POST /mcp` — the MCP endpoint (bearer token required).
- `GET /.well-known/oauth-protected-resource/mcp` — protected resource metadata.
- `GET /.well-known/oauth-authorization-server` — mirror of the backend's authorization server metadata.
- `GET /healthz` — `200` once the backend's OAuth metadata is loaded, `503` before.
- `GET /icon.svg`, `GET /icon.png` — the Monexa icon.

## Local development

Run the backend with `OAUTH_ISSUER_URL=http://localhost:9000`, `MCP_RESOURCE_URL=http://localhost:3001/mcp` and the same `MCP_CLIENT_ID`/`MCP_CLIENT_SECRET`, then:

```bash
cd mcp-server
npm install
PORT=3001 MCP_PUBLIC_URL=http://localhost:3001 MONEXA_OAUTH_ISSUER=http://localhost:9000 \
  MONEXA_API_URL=http://localhost:9000 MCP_CLIENT_ID=… MCP_CLIENT_SECRET=… npm run dev

npm run typecheck   # tsc --noEmit
npm run build       # compile to dist/
npm start           # node dist/index.js
```
