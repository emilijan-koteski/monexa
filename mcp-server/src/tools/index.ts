import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAuthTools } from "./auth.js";
import { registerRecordTools } from "./records.js";
import { registerCategoryTools } from "./categories.js";
import { registerPaymentMethodTools } from "./payment-methods.js";
import { registerSettingsTools } from "./settings.js";
import { registerUserTools } from "./user.js";

export function registerAllTools(server: McpServer): void {
  registerAuthTools(server);
  registerRecordTools(server);
  registerCategoryTools(server);
  registerPaymentMethodTools(server);
  registerSettingsTools(server);
  registerUserTools(server);
}
