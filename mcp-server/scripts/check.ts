import { existsSync, readFileSync } from "node:fs";
import { excludedRoutes } from "../src/tools/excluded.js";
import { toolDefinitions } from "../src/tools/index.js";
import { VERSION } from "../src/version.js";
import { findDriftProblems } from "./drift.js";
import { findServerJsonProblems } from "./server-json.js";
import { renderToolsDoc, TOOLS_DOC_FILE } from "./tools-doc.js";

const API_ROUTES_FILE = new URL("../../docs/api-routes.json", import.meta.url);
const SERVER_JSON_FILE = new URL("../server.json", import.meta.url);

interface ApiRoute {
  method: string;
  path: string;
}

/** Reads the backend route inventory written by `go run ./cmd/routes -write`, as `METHOD /path` keys. */
function loadApiRoutes(): string[] {
  const routes = JSON.parse(readFileSync(API_ROUTES_FILE, "utf8")) as ApiRoute[];
  return routes.map(({ method, path }) => `${method} ${path}`);
}

const routes = loadApiRoutes();
const problems = [
  ...findDriftProblems({
    routes,
    tools: toolDefinitions,
    excluded: excludedRoutes,
    toolsDoc: existsSync(TOOLS_DOC_FILE) ? readFileSync(TOOLS_DOC_FILE, "utf8") : undefined,
    expectedToolsDoc: renderToolsDoc(toolDefinitions, excludedRoutes),
  }),
  ...findServerJsonProblems({
    serverJson: JSON.parse(readFileSync(SERVER_JSON_FILE, "utf8")),
    packageVersion: VERSION,
  }),
];

if (problems.length > 0) {
  console.error(`MCP drift check failed with ${problems.length} problem(s):`);
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  process.exit(1);
}

const coveredRoutes = new Set(toolDefinitions.flatMap((tool) => tool.covers));
console.log(
  `MCP drift check passed: ${toolDefinitions.length} tools cover ${coveredRoutes.size} of ${routes.length} routes, ` +
    `${excludedRoutes.length} are intentionally not exposed, TOOLS.md is up to date and server.json matches package.json.`,
);
