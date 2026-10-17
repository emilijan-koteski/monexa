import { McpServer, type Icon } from "@modelcontextprotocol/server";
import type { AppContext } from "./context.js";
import { registerAllTools } from "./tools/index.js";
import { VERSION } from "./version.js";

export const SVG_ICON_PATH = "/icon.svg";
export const PNG_ICON_PATH = "/icon.png";

const WEBSITE_URL = "https://monexa.world";

export const SERVER_INSTRUCTIONS = [
  "Monexa is a personal finance tracker. Users record income and expenses as records, each with an amount, a currency, a date, a category and a payment method, and can define recurring expenses and trend reports.",
  "Categories, payment methods, records, recurring expenses and trend reports are identified by numeric IDs that come from the corresponding list tools.",
  "Supported currencies are MKD, EUR, USD, AUD, CHF and GBP. Each record keeps its own currency; summaries and statistics are converted into the display currency from the user's settings.",
  "Dates are accepted as YYYY-MM-DD or as full RFC 3339 timestamps; full timestamps are used as given. A date-only record date is stored as 12:00 UTC on that day. Recurring-expense start and end dates keep only their UTC calendar day. In date-range filters a date-only start means 00:00:00 UTC and a date-only end means 23:59:59 UTC, both inclusive.",
  "Today is the current date in UTC; get_profile returns it, and create_record uses it when no date is given.",
].join("\n");

/** Builds the MCP server for one request: identity, instructions, icons and every tool. */
export function buildServer(ctx: AppContext): McpServer {
  const server = new McpServer(
    {
      name: "monexa",
      title: "Monexa",
      version: VERSION,
      websiteUrl: WEBSITE_URL,
      icons: serverIcons(ctx.config.publicUrl),
    },
    {
      instructions: SERVER_INSTRUCTIONS,
      capabilities: { tools: {} },
    },
  );
  registerAllTools(server, ctx);
  return server;
}

export function serverIcons(publicUrl: string): Icon[] {
  return [
    { src: publicUrl + SVG_ICON_PATH, mimeType: "image/svg+xml", sizes: ["any"] },
    { src: publicUrl + PNG_ICON_PATH, mimeType: "image/png", sizes: ["512x512"] },
  ];
}
