import type { McpServer } from "@modelcontextprotocol/server";
import type { AppContext } from "../context.js";

export interface ToolDefinition {
  name: string;
  register(server: McpServer, ctx: AppContext): void;
}

export const toolDefinitions: readonly ToolDefinition[] = [];

/** Registers every tool in catalog order. */
export function registerAllTools(server: McpServer, ctx: AppContext): void {
  for (const tool of toolDefinitions) {
    tool.register(server, ctx);
  }
}
