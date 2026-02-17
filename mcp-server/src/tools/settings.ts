import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiRequest } from "../client.js";
import type { Setting } from "../types.js";

export function registerSettingsTools(server: McpServer): void {
  server.tool(
    "get-settings",
    "Get the current user's settings including preferred display language and default currency.",
    {},
    async () => {
      const settings = await apiRequest<Setting>("GET", "/settings");
      return {
        content: [
          { type: "text", text: JSON.stringify(settings, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "update-settings",
    "Update user preferences. Can change the display language (EN or MK) and/or the default currency used for summaries and statistics.",
    {
      language: z
        .enum(["EN", "MK"])
        .optional()
        .describe("Display language: EN (English) or MK (Macedonian)"),
      currency: z
        .enum(["MKD", "EUR", "USD", "AUD", "CHF", "GBP"])
        .optional()
        .describe("Default currency for display and conversions"),
    },
    async (input) => {
      const settings = await apiRequest<Setting>("PATCH", "/settings", {
        body: input,
      });
      return {
        content: [
          { type: "text", text: JSON.stringify(settings, null, 2) },
        ],
      };
    }
  );
}
