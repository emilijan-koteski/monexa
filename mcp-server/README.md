# Monexa MCP Server

MCP server for the [Monexa](https://monexa.world) personal finance API — manage your finances with AI.

This server implements the [Model Context Protocol (MCP)](https://modelcontextprotocol.io) to let AI assistants interact with your Monexa account: create records, manage categories and payment methods, view spending statistics, and more.

## Prerequisites

- Node.js 20 or later
- A Monexa account ([sign up at monexa.world](https://monexa.world))

## Setup

### Claude Desktop

Add this to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "monexa": {
      "command": "npx",
      "args": ["-y", "monexa-mcp-server"],
      "env": {
        "MONEXA_EMAIL": "your@email.com",
        "MONEXA_PASSWORD": "your_password"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add monexa -- npx -y monexa-mcp-server
```

Then set the environment variables in `.claude/mcp.json`:

```json
{
  "mcpServers": {
    "monexa": {
      "command": "npx",
      "args": ["-y", "monexa-mcp-server"],
      "env": {
        "MONEXA_EMAIL": "your@email.com",
        "MONEXA_PASSWORD": "your_password"
      }
    }
  }
}
```

### Other MCP Clients

Any MCP-compatible client can use this server via stdio transport. Run:

```bash
npx monexa-mcp-server
```

With environment variables `MONEXA_EMAIL` and `MONEXA_PASSWORD` set.

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `MONEXA_EMAIL` | No | Auto-login at startup if both email and password are provided |
| `MONEXA_PASSWORD` | No | Auto-login at startup if both email and password are provided |
| `MONEXA_API_BASE_URL` | No | Defaults to `https://api.monexa.world/api/v1` |

If credentials are not provided, the server starts without authentication. Use the `login` or `register` tool to authenticate.

## Available Tools

### Auth

| Tool | Description |
|------|-------------|
| `login` | Log in with email and password |
| `register` | Create a new Monexa account |

### Records

| Tool | Description |
|------|-------------|
| `list-records` | List records with filters (date range, category, payment method, search, sort) |
| `get-record` | Get a single record by ID |
| `create-record` | Create an income or expense record |
| `update-record` | Update a record (partial update) |
| `delete-record` | Delete a record |
| `get-records-summary` | Get net balance for a date range |

### Categories

| Tool | Description |
|------|-------------|
| `list-categories` | List all categories (income and expense) |
| `create-category` | Create a new category |
| `update-category` | Update a category |
| `delete-category` | Delete a category |
| `get-category-statistics` | Get spending/income breakdown by category |

### Payment Methods

| Tool | Description |
|------|-------------|
| `list-payment-methods` | List all payment methods |
| `create-payment-method` | Create a new payment method |
| `update-payment-method` | Rename a payment method |
| `delete-payment-method` | Delete a payment method |

### Settings & Profile

| Tool | Description |
|------|-------------|
| `get-settings` | Get user preferences (language, currency) |
| `update-settings` | Change default currency or language |
| `get-profile` | Get current user profile |
| `update-profile` | Update display name |

## Supported Values

**Currencies:** `MKD`, `EUR`, `USD`, `AUD`, `CHF`, `GBP`

**Category types:** `INCOME`, `EXPENSE`

**Languages:** `EN` (English), `MK` (Macedonian)

## Development

```bash
git clone https://github.com/emilijan-koteski/monexa.git
cd monexa/mcp-server
npm install
npm run dev
```

Test with the [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector):

```bash
npx @modelcontextprotocol/inspector npx monexa-mcp-server
```
