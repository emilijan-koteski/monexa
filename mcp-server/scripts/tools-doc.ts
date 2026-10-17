import { fileURLToPath } from "node:url";
import type { ExcludedRoute } from "../src/tools/excluded.js";
import type { ToolDefinition } from "../src/tools/index.js";

export const TOOLS_DOC_FILE = fileURLToPath(new URL("../TOOLS.md", import.meta.url));

/** Renders TOOLS.md: every tool with its access and REST endpoints, then every route deliberately left out. */
export function renderToolsDoc(tools: readonly ToolDefinition[], excluded: readonly ExcludedRoute[]): string {
  return [
    "# Monexa MCP tools",
    "",
    "Generated from the tool registry in `src/tools` by `npm run docs`. `npm run check` fails when this file is out of date.",
    "",
    "## Tools",
    "",
    "| Tool | Title | Access | REST endpoints | Since |",
    "| --- | --- | --- | --- | --- |",
    ...tools.map(
      (tool) =>
        `| \`${tool.name}\` | ${cell(tool.title)} | ${tool.annotations.readOnlyHint ? "read" : "write"} | ` +
        `${tool.covers.map((route) => `\`${route}\``).join("<br>")} | ${tool.since} |`,
    ),
    "",
    "## Intentionally not exposed",
    "",
    "| Route | Reason |",
    "| --- | --- |",
    ...excluded.map(({ route, reason }) => `| \`${route}\` | ${cell(reason)} |`),
    "",
  ].join("\n");
}

function cell(text: string): string {
  return text.replaceAll("|", "\\|");
}
