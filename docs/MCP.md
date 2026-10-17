# Monexa for AI assistants

Monexa runs a hosted [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server, so AI assistants can read and manage your Monexa data when you ask them to. The server is at

```
https://mcp.monexa.world/mcp
```

Each release is published to the official MCP Registry as `io.github.emilijan-koteski/monexa`. This guide covers connecting an assistant, access tokens for your own agents, permissions, privacy, self-hosting and troubleshooting. Developers working on the server should read the [server README](../mcp-server/README.md).

## What you can do

Once connected, ask in plain language:

- "Log 300 MKD for coffee."
- "How much did I spend on food this month?"
- "Show my five biggest expenses from last week."
- "Add a category called Gym and move my Fitpass payments into it."
- "Pause my monthly rent expense."
- "Switch my display currency to EUR."
- "What does my 2026 trend report show for expenses?"

The assistant can work with your records, categories, payment methods, recurring expenses, trend reports and settings. Amounts keep their own currency, and summaries use your display currency.

## Connect an assistant

Connecting uses OAuth: the assistant opens a Monexa page where you sign in and approve access. Your password is never shared with the assistant; it receives a token that you can revoke at any time under Connected apps.

### Claude (web, desktop and mobile)

1. In Claude, open Customize, then Connectors, then Add custom connector.
2. Enter `Monexa` as the name and `https://mcp.monexa.world/mcp` as the URL.
3. Sign in to Monexa when the page opens, review the permissions and select Approve.

Add the connector on claude.ai or Claude Desktop; it is then available in the mobile apps on the same account. On Team and Enterprise plans an organization owner adds the connector first.

### Claude Code

```bash
claude mcp add --transport http monexa https://mcp.monexa.world/mcp
```

Start Claude Code, run `/mcp`, choose `monexa` and sign in. To skip the browser sign-in, use an [access token](#access-tokens-for-your-own-agents) instead.

### ChatGPT

1. Open Settings, then Apps & Connectors, then Advanced settings, and turn on Developer mode.
2. Create a connector, enter `https://mcp.monexa.world/mcp` as the MCP server URL and choose OAuth for authentication.
3. Sign in to Monexa and approve access.

Availability of custom connectors depends on your ChatGPT plan and workspace settings.

### Other apps

Any MCP client that supports Streamable HTTP and OAuth can connect with the same URL. Clients that cannot open a browser sign-in can send an access token instead.

## The consent screen

Before an app gets access, Monexa shows a screen with:

- **The app's name and a badge.** An app whose client ID is an https URL on claude.ai or chatgpt.com shows a green Verified badge. Any other app shows an orange Unverified app badge; make sure you recognize it and started the connection yourself.
- **Where you will be sent.** "After you approve, you'll be sent to" an address, which should belong to the app you are connecting.
- **What the app will be able to do.** Viewing your data, optionally creating, editing and deleting it and changing your settings, and staying connected until you disconnect it.
- **The account you are signed in as**, with a Not you? link to switch accounts.

Select Approve to connect or Deny to cancel. Nothing is shared until you approve.

## Permissions

| Permission | Scope | Allows |
| --- | --- | --- |
| Read | `monexa.read` | Viewing records, categories, payment methods, recurring expenses, trend reports and settings. |
| Read & write | `monexa.read` and `monexa.write` | Everything in Read, plus creating, editing and deleting records, categories, payment methods and recurring expenses and changing your settings. Trend reports stay read-only through the MCP tools, although the permission allows more at the API level. |

An app asks for the permissions it needs, and the consent screen lists them. If you want an agent to only look at your data, create a read-only [access token](#access-tokens-for-your-own-agents). A read-only connection that tries to change something gets the message "This connection doesn't have permission for that (it may be read-only)."

Connected apps can never sign in on your behalf, change your password, edit your profile, export your data, delete your account, or manage other connections and tokens. Those actions exist only in the Monexa app.

## Disconnect an app

Open Settings, then Connected apps in the Monexa web app. Under AI apps, select Disconnect next to the app. Under Access tokens, select Revoke next to a token.

Access ends within about 4 minutes. Signing out of Monexa does not disconnect apps, and removing the connector inside an assistant does not revoke it in Monexa, so disconnect it here as well.

Changing or resetting your password, or deleting your account, disconnects all AI apps and revokes all access tokens.

## Access tokens for your own agents

Personal access tokens let scripts, automations and agents you run yourself connect without a browser sign-in.

1. In the Monexa web app, open Settings, then Connected apps.
2. Under Access tokens, select Create token.
3. Enter a name (up to 50 characters), choose Read or Read & write, and choose an expiry of 30, 90 (the default) or 365 days.
4. Copy the token, which starts with `mnx_pat_`. It is shown once and cannot be retrieved later.

You can have 10 active tokens at a time. Revoke a token from the same page when you no longer need it. The examples below send the token as `Authorization: Bearer mnx_pat_…`; replace `mnx_pat_YOUR_TOKEN` with yours and keep it out of version control.

### Claude Code

```bash
claude mcp add --transport http monexa https://mcp.monexa.world/mcp \
  --header "Authorization: Bearer mnx_pat_YOUR_TOKEN"
```

### Cursor

Add this to `~/.cursor/mcp.json`, or to `.cursor/mcp.json` in a project. Cursor reads the token from an environment variable, so the file can be shared safely.

```json
{
  "mcpServers": {
    "monexa": {
      "url": "https://mcp.monexa.world/mcp",
      "headers": {
        "Authorization": "Bearer ${env:MONEXA_TOKEN}"
      }
    }
  }
}
```

### VS Code

Add this to `.vscode/mcp.json`. VS Code asks for the token the first time and stores it securely.

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "monexa-token",
      "description": "Monexa access token",
      "password": true
    }
  ],
  "servers": {
    "monexa": {
      "type": "http",
      "url": "https://mcp.monexa.world/mcp",
      "headers": {
        "Authorization": "Bearer ${input:monexa-token}"
      }
    }
  }
}
```

### n8n

Add an MCP Client Tool node to your AI Agent and set:

- **Endpoint:** `https://mcp.monexa.world/mcp`
- **Server Transport:** HTTP Streamable
- **Authentication:** Bearer Auth, with a credential whose token is your access token. A Header Auth credential with the name `Authorization` and the value `Bearer mnx_pat_YOUR_TOKEN` works as well.

Option names vary slightly between n8n versions.

### OpenAI Agents SDK (Python)

Install the SDK with `pip install openai-agents`, then run this script with `OPENAI_API_KEY` and `MONEXA_TOKEN` set:

```python
import asyncio
import os

from agents import Agent, Runner
from agents.mcp import MCPServerStreamableHttp

MONEXA_MCP_URL = os.environ.get("MONEXA_MCP_URL", "https://mcp.monexa.world/mcp")


async def main() -> None:
    token = os.environ["MONEXA_TOKEN"]
    async with MCPServerStreamableHttp(
        name="Monexa",
        params={
            "url": MONEXA_MCP_URL,
            "headers": {"Authorization": f"Bearer {token}"},
            "timeout": 15,
        },
        cache_tools_list=True,
    ) as monexa:
        agent = Agent(
            name="Finance assistant",
            instructions="Answer questions about the user's spending using the Monexa tools.",
            mcp_servers=[monexa],
        )
        result = await Runner.run(agent, "How much did I spend on food this month?")
        print(result.final_output)


asyncio.run(main())
```

The script connects to Monexa, lets the agent call its tools and prints the answer. Use a read-only token for agents that should only report.

### LangChain

Install the packages with `pip install langchain langchain-mcp-adapters langchain-openai`, then run this script with `OPENAI_API_KEY` and `MONEXA_TOKEN` set:

```python
import asyncio
import os

from langchain.agents import create_agent
from langchain_mcp_adapters.client import MultiServerMCPClient

MONEXA_MCP_URL = os.environ.get("MONEXA_MCP_URL", "https://mcp.monexa.world/mcp")


async def main() -> None:
    client = MultiServerMCPClient(
        {
            "monexa": {
                "transport": "streamable_http",
                "url": MONEXA_MCP_URL,
                "headers": {"Authorization": f"Bearer {os.environ['MONEXA_TOKEN']}"},
            }
        }
    )
    tools = await client.get_tools()
    agent = create_agent("openai:gpt-4.1", tools)
    response = await agent.ainvoke({"messages": "How much did I spend on food this month?"})
    print(response["messages"][-1].content)


asyncio.run(main())
```

### MCP Inspector

The [MCP Inspector](https://github.com/modelcontextprotocol/inspector) is the quickest way to try the tools by hand:

```bash
npx @modelcontextprotocol/inspector
```

Choose the Streamable HTTP transport and enter `https://mcp.monexa.world/mcp`. Then either complete the OAuth sign-in the Inspector offers when the server asks for authentication, or add a custom header named `Authorization` with the value `Bearer mnx_pat_YOUR_TOKEN`. From a terminal, list the tools with

```bash
npx @modelcontextprotocol/inspector --cli https://mcp.monexa.world/mcp --transport http \
  --header "Authorization: Bearer mnx_pat_YOUR_TOKEN" --method tools/list
```

## Tools

The server offers 22 tools:

| Area | Read | Write |
| --- | --- | --- |
| Profile and settings | `get_profile` | `update_settings` |
| Records | `list_records`, `get_record` | `create_record`, `update_record`, `delete_record` |
| Categories | `list_categories` | `create_category`, `update_category`, `delete_category` |
| Payment methods | `list_payment_methods` | `create_payment_method`, `update_payment_method`, `delete_payment_method` |
| Recurring expenses | `list_recurring_expenses` | `create_recurring_expense`, `update_recurring_expense`, `delete_recurring_expense` |
| Reports | `get_spending_summary`, `list_trend_reports`, `get_trend_report_data` | |

Read tools only look at your data; write tools need the Read & write permission. [TOOLS.md](../mcp-server/TOOLS.md) lists every tool with its REST endpoints and the version that introduced it, and the routes that are deliberately not exposed. Tool names and schemas follow semantic versioning; see the [changelog](../mcp-server/CHANGELOG.md).

## Privacy

- An assistant only receives what its tool calls return, which is the data you ask it about. That data is then processed by the assistant's provider, such as Anthropic or OpenAI, under that provider's own terms. Monexa does not control how they handle it.
- Monexa stores access tokens and refresh tokens only as hashes. A personal access token is shown once, when you create it.
- The MCP server stores none of your data. It logs request metadata (the method, tool name, status, duration and client ID) and never tokens, tool arguments or results.
- The MCP server does not run analytics or tracking.
- Under Settings, then Connected apps, you can see each connection, its permission, when it was connected and when it was last used, and end it at any time.

## Limits

- `list_records` returns at most 500 records per call (50 by default) and has no paging beyond that. Narrow the request by date range, category, payment method or search text; the response says when it was cut off.
- Supported currencies are MKD, EUR, USD, AUD, CHF and GBP.
- Trend reports are read-only for now. Creating, editing and deleting them is planned for a later release.
- Dates are `YYYY-MM-DD` or full RFC 3339 timestamps. A date-only record date is stored as 12:00 UTC that day.
- You can have 10 active access tokens, and each expires after 30, 90 or 365 days.

## Self-hosting

You can run your own Monexa backend and MCP server. The MCP server is a separate Docker service (`ghcr.io/emilijan-koteski/monexa-mcp`) that talks to the backend over HTTP. Set these on the backend:

| Backend variable | Description |
| --- | --- |
| `OAUTH_ISSUER_URL` | Public origin of the backend, for example `https://api.example.com`, with no trailing slash, a lowercase host and no default port. |
| `MCP_RESOURCE_URL` | The public MCP endpoint, for example `https://mcp.example.com/mcp`, in normalized form. |
| `MCP_CLIENT_ID` | An identifier for the MCP server's client. |
| `MCP_CLIENT_SECRET` | At least 32 characters; `openssl rand -hex 32` works. |
| `OAUTH_ACCESS_TOKEN_TTL`, `OAUTH_REFRESH_TOKEN_TTL` | Optional Go durations, defaults `1h` and `2160h`. |

The four required variables go together: set all of them or none, otherwise the backend refuses to start. Without them it serves no OAuth routes. On the MCP service:

| MCP variable | Must match |
| --- | --- |
| `MCP_PUBLIC_URL` (the origin, for example `https://mcp.example.com`) | `MCP_RESOURCE_URL` without the `/mcp` suffix |
| `MONEXA_OAUTH_ISSUER` | `OAUTH_ISSUER_URL` |
| `MCP_CLIENT_ID` | `MCP_CLIENT_ID` |
| `MCP_CLIENT_SECRET` | `MCP_CLIENT_SECRET` |

The service also needs `MONEXA_API_URL` (where it reaches the backend, usually an internal address), `ALLOWED_HOSTS` (the hostnames it is served on) and optionally `OPENAI_APPS_CHALLENGE_TOKEN`. Both URLs must use https, except for `localhost`, `127.0.0.1` and `[::1]` during development. AI providers call the backend's `/oauth/*` and `/.well-known/*` routes and the MCP server directly from their own servers, so those must be reachable from the internet. To make the access token snippets in the web app show your URL, build the frontend with `VITE_MCP_URL`. The full variable reference is in the [server README](../mcp-server/README.md) and the Dokploy setup is in [DEPLOYMENT.md](DEPLOYMENT.md).

## Troubleshooting

| Symptom | What to do |
| --- | --- |
| The assistant keeps asking you to sign in again, or calls fail with 401. | The connection was disconnected, revoked or has expired. Remove the connector in the assistant and add it again. For an access token, create a new one and check that the header is exactly `Authorization: Bearer mnx_pat_…`. |
| "Monexa needs you to accept updated terms." | Open [monexa.world](https://monexa.world), sign in, accept the updated terms and try again. |
| "This connection doesn't have permission for that (it may be read-only)." | The connection has the Read permission only. Reconnect with Read & write, or create a Read & write token. |
| "Your Monexa session for this app expired." | Try again. If it keeps failing, reconnect the app. |
| 503 or "temporarily unavailable". | The MCP server could not reach Monexa, or is still starting. Wait a few seconds and retry; the assistant does not need to be reconnected. When self-hosting, check `MONEXA_API_URL`, that the client credentials match on both sides, and `GET /healthz` on the MCP service. |
| The tools do not show up in Claude Code. | Run `/mcp` to check the connection state and sign in if it says it needs authentication. |
| A self-hosted server rejects every request. | Add the public hostname to `ALLOWED_HOSTS`, and check that `MCP_PUBLIC_URL`, `MONEXA_OAUTH_ISSUER` and the backend's `OAUTH_ISSUER_URL` and `MCP_RESOURCE_URL` agree as described above. |

## Support

Questions, bug reports or feedback: [emilijankoteski@pm.me](mailto:emilijankoteski@pm.me), or open an issue on [GitHub](https://github.com/emilijan-koteski/monexa/issues). The server is open source under the MIT license.
