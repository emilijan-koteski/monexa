# Changelog

All notable changes to the Monexa MCP server are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html): a major version removes or renames a tool or breaks a tool's schema, a minor version adds a tool or an optional parameter, and a patch version fixes bugs.

## [Unreleased]

## [2.0.0] - 2026-10-17

### Changed

- Rewritten as a hosted remote MCP server at `https://mcp.monexa.world/mcp`, using the Streamable HTTP transport with OAuth 2.1 and personal access tokens (`mnx_pat_…`) for authentication. Tokens are exchanged at the Monexa backend for short-lived delegated credentials.
- The stdio npm package `monexa-mcp-server@1.x` is deprecated. Connect to the hosted server instead; see [docs/MCP.md](../docs/MCP.md).

### Added

- 22 tools, each with a title, input and output schemas and `readOnlyHint`, `destructiveHint`, `idempotentHint` and `openWorldHint` annotations:
  - Profile and settings: `get_profile`, `update_settings`.
  - Records: `list_records`, `get_record`, `create_record`, `update_record`, `delete_record`.
  - Categories: `list_categories`, `create_category`, `update_category`, `delete_category`.
  - Payment methods: `list_payment_methods`, `create_payment_method`, `update_payment_method`, `delete_payment_method`.
  - Recurring expenses: `list_recurring_expenses`, `create_recurring_expense`, `update_recurring_expense`, `delete_recurring_expense`.
  - Reports: `get_spending_summary`, `list_trend_reports`, `get_trend_report_data`.
- Server icons (SVG and PNG), served from `/icon.svg` and `/icon.png` and advertised in the server metadata and the MCP Registry manifest.
- Server instructions describing Monexa's data model, currencies and date formats.
- `server.json` for the official MCP Registry, published as `io.github.emilijan-koteski/monexa`.
- `npm run check`, a drift guard that keeps the tools in step with the backend's API routes, and a generated [TOOLS.md](TOOLS.md).

### Removed

- The `login` and `register` tools, and sign-in with `MONEXA_EMAIL` and `MONEXA_PASSWORD`. Apps authenticate with OAuth or a personal access token instead.
- Local stdio operation and the configurable `MONEXA_API_BASE_URL`.

## [1.0.0] - 2026-02-17

- Initial release: a local stdio MCP server published to npm as `monexa-mcp-server`, signing in with a Monexa email and password.

[Unreleased]: https://github.com/emilijan-koteski/monexa/compare/mcp-v2.0.0...HEAD
[2.0.0]: https://github.com/emilijan-koteski/monexa/releases/tag/mcp-v2.0.0
[1.0.0]: https://github.com/emilijan-koteski/monexa/commit/25d2113
