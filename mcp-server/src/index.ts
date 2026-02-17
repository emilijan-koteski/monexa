#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { login } from "./auth.js";
import { registerAllTools } from "./tools/index.js";

async function main() {
  const email = process.env.MONEXA_EMAIL;
  const password = process.env.MONEXA_PASSWORD;

  // Auto-login if credentials are provided
  if (email && password) {
    try {
      await login(email, password);
      console.error(`Authenticated as ${email}`);
    } catch (err) {
      console.error(
        "Auto-login failed:",
        err instanceof Error ? err.message : err
      );
      console.error(
        "Server will start without auth. Use the login tool to authenticate."
      );
    }
  }

  const server = new McpServer({
    name: "monexa",
    version: "1.0.0",
  });

  registerAllTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
