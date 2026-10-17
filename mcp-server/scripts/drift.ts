import type { ExcludedRoute } from "../src/tools/excluded.js";
import type { ToolDefinition, ToolHints } from "../src/tools/definition.js";

const TOOL_NAME_PATTERN = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
const MAX_TOOL_NAME_LENGTH = 64;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const HINTS: readonly (keyof ToolHints)[] = ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"];
const ROUTES_FILE = "docs/api-routes.json";

export interface DriftCheckInput {
  routes: readonly string[];
  tools: readonly ToolDefinition[];
  excluded: readonly ExcludedRoute[];
  toolsDoc: string | undefined;
  expectedToolsDoc: string;
}

/** Lists every way the tool registry, excluded.ts and TOOLS.md disagree with the backend route inventory. */
export function findDriftProblems(input: DriftCheckInput): string[] {
  return [
    ...input.tools.flatMap(toolProblems),
    ...duplicateNameProblems(input.tools),
    ...routeProblems(input),
    ...toolsDocProblems(input),
  ];
}

function toolProblems(tool: ToolDefinition): string[] {
  const label = `Tool "${tool.name}"`;
  const problems: string[] = [];
  if (!TOOL_NAME_PATTERN.test(tool.name)) {
    problems.push(`${label} must be snake_case (lowercase letters and digits separated by single underscores).`);
  }
  if (tool.name.length > MAX_TOOL_NAME_LENGTH) {
    problems.push(`${label} has a name longer than ${MAX_TOOL_NAME_LENGTH} characters.`);
  }
  if (!tool.title?.trim()) {
    problems.push(`${label} has no title.`);
  }
  for (const hint of HINTS) {
    if (typeof tool.annotations?.[hint] !== "boolean") {
      problems.push(`${label} must set annotations.${hint} to true or false.`);
    }
  }
  if (tool.annotations?.openWorldHint !== false) {
    problems.push(`${label} must set annotations.openWorldHint to false.`);
  }
  if (tool.covers.length === 0) {
    problems.push(`${label} covers no route; list every REST route it calls in covers.`);
  }
  if (tool.annotations?.readOnlyHint) {
    for (const route of tool.covers.filter((route) => !route.startsWith("GET "))) {
      problems.push(`${label} is read-only but covers "${route}"; read-only tools may only call GET routes.`);
    }
  }
  if (!VERSION_PATTERN.test(tool.since)) {
    problems.push(`${label} has since "${tool.since}", which is not a MAJOR.MINOR.PATCH version.`);
  }
  return problems;
}

function duplicateNameProblems(tools: readonly ToolDefinition[]): string[] {
  return duplicates(tools.map((tool) => tool.name)).map((name) => `Tool name "${name}" is used by more than one tool.`);
}

function routeProblems({ routes, tools, excluded }: DriftCheckInput): string[] {
  const knownRoutes = new Set(routes);
  const coveringTools = new Map<string, string[]>();
  for (const tool of tools) {
    for (const route of new Set(tool.covers)) {
      coveringTools.set(route, [...(coveringTools.get(route) ?? []), tool.name]);
    }
  }
  const excludedRoutes = new Set<string>(excluded.map(({ route }) => route));
  const problems: string[] = [];
  for (const tool of tools) {
    for (const route of tool.covers.filter((route) => !knownRoutes.has(route))) {
      problems.push(`Tool "${tool.name}" covers "${route}", which is not in ${ROUTES_FILE}.`);
    }
  }
  for (const { route, reason } of excluded) {
    if (!knownRoutes.has(route)) {
      problems.push(`excluded.ts lists "${route}", which is not in ${ROUTES_FILE}; remove it.`);
    }
    if (!reason.trim()) {
      problems.push(`excluded.ts lists "${route}" without a reason.`);
    }
  }
  for (const route of duplicates(excluded.map(({ route }) => route))) {
    problems.push(`excluded.ts lists "${route}" more than once.`);
  }
  for (const route of routes) {
    const coveredBy = coveringTools.get(route);
    if (coveredBy && excludedRoutes.has(route)) {
      problems.push(`"${route}" is covered by ${coveredBy.join(", ")} and also listed in excluded.ts; remove it from excluded.ts.`);
    }
    if (!coveredBy && !excludedRoutes.has(route)) {
      problems.push(`"${route}" is neither covered by a tool nor listed in excluded.ts; add a tool or an excluded entry with a reason.`);
    }
  }
  return problems;
}

function toolsDocProblems({ toolsDoc, expectedToolsDoc }: DriftCheckInput): string[] {
  if (toolsDoc === undefined) {
    return ["TOOLS.md is missing; run `npm run docs`."];
  }
  if (toolsDoc === expectedToolsDoc) {
    return [];
  }
  const line = firstDifferentLine(toolsDoc, expectedToolsDoc);
  return [`TOOLS.md is out of date (first difference at line ${line}); run \`npm run docs\` and commit the result.`];
}

function firstDifferentLine(actual: string, expected: string): number {
  const actualLines = actual.split("\n");
  const expectedLines = expected.split("\n");
  const index = expectedLines.findIndex((line, i) => line !== actualLines[i]);
  return (index === -1 ? expectedLines.length : index) + 1;
}

function duplicates(values: readonly string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
}
