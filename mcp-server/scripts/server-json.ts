const MAX_DESCRIPTION_LENGTH = 100;

export interface ServerJsonCheckInput {
  serverJson: { version?: unknown; description?: unknown };
  packageVersion: string;
}

/** Lists the ways server.json, the MCP Registry manifest, disagrees with package.json or the registry's limits. */
export function findServerJsonProblems({ serverJson, packageVersion }: ServerJsonCheckInput): string[] {
  const problems: string[] = [];
  if (serverJson.version !== packageVersion) {
    problems.push(
      `server.json version is "${String(serverJson.version)}" but package.json version is "${packageVersion}"; make them equal.`,
    );
  }
  const description = serverJson.description;
  if (typeof description !== "string" || description.trim() === "") {
    problems.push("server.json needs a non-empty description.");
  } else if (description.length > MAX_DESCRIPTION_LENGTH) {
    problems.push(
      `server.json description is ${description.length} characters; the MCP Registry allows at most ${MAX_DESCRIPTION_LENGTH}.`,
    );
  }
  return problems;
}
