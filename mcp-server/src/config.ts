import { z } from "zod/v4";

export interface Config {
  port: number;
  publicUrl: string;
  resourceUrl: string;
  oauthIssuer: string;
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  allowedHosts: string[];
  openaiAppsChallengeToken: string | undefined;
}

export class ConfigError extends Error {
  override name = "ConfigError";
}

const DEFAULT_PORT = 8080;
const MAX_PORT = 65535;
const MIN_CLIENT_SECRET_LENGTH = 32;
const MCP_PATH = "/mcp";
const DEVELOPMENT_ALLOWED_HOSTS = ["localhost", "127.0.0.1"];
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);
const ALLOWED_HOST_PATTERN = /^(\[[0-9a-f:.]+\]|[a-z0-9.-]+)$/;

type RefinementContext = z.core.$RefinementCtx<string>;

const requiredString = z
  .string({ error: (issue) => (issue.input === undefined ? "is required" : "must be a string") })
  .trim()
  .min(1, "is required");

const optionalString = z
  .string()
  .optional()
  .transform((value) => value?.trim() || undefined);

const portSchema = optionalString.transform((value, ctx) => {
  if (value === undefined) {
    return DEFAULT_PORT;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) {
    ctx.addIssue({ code: "custom", input: value, message: `must be an integer between 1 and ${MAX_PORT}` });
    return z.NEVER;
  }
  return port;
});

const envSchema = z
  .object({
    PORT: portSchema,
    MCP_PUBLIC_URL: requiredString.transform(parsePublicUrl),
    MONEXA_OAUTH_ISSUER: requiredString.transform(parseIssuer),
    MONEXA_API_URL: requiredString.transform(parseApiUrl),
    MCP_CLIENT_ID: requiredString,
    MCP_CLIENT_SECRET: requiredString.min(
      MIN_CLIENT_SECRET_LENGTH,
      `must be at least ${MIN_CLIENT_SECRET_LENGTH} characters`,
    ),
    ALLOWED_HOSTS: optionalString.transform(parseAllowedHosts),
    OPENAI_APPS_CHALLENGE_TOKEN: optionalString,
    NODE_ENV: optionalString,
  })
  .superRefine((env, ctx) => {
    if (env.ALLOWED_HOSTS.length === 0 && env.NODE_ENV === "production") {
      ctx.addIssue({ code: "custom", path: ["ALLOWED_HOSTS"], message: "is required in production" });
      return;
    }
    const publicHost = new URL(env.MCP_PUBLIC_URL).hostname;
    if (!allowedHostsOrDefault(env.ALLOWED_HOSTS).includes(publicHost)) {
      ctx.addIssue({
        code: "custom",
        path: ["ALLOWED_HOSTS"],
        message: `must include the MCP_PUBLIC_URL host "${publicHost}"`,
      });
    }
  });

/** Validates the environment and derives the MCP resource URL; throws a ConfigError listing the problems found. */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  - ${issue.path.join(".")} ${issue.message}`);
    throw new ConfigError(`Invalid configuration:\n${problems.join("\n")}`);
  }
  const parsed = result.data;
  return {
    port: parsed.PORT,
    publicUrl: parsed.MCP_PUBLIC_URL,
    resourceUrl: parsed.MCP_PUBLIC_URL + MCP_PATH,
    oauthIssuer: parsed.MONEXA_OAUTH_ISSUER,
    apiUrl: parsed.MONEXA_API_URL,
    clientId: parsed.MCP_CLIENT_ID,
    clientSecret: parsed.MCP_CLIENT_SECRET,
    allowedHosts: allowedHostsOrDefault(parsed.ALLOWED_HOSTS),
    openaiAppsChallengeToken: parsed.OPENAI_APPS_CHALLENGE_TOKEN,
  };
}

/** Accepts an origin only and returns it normalized: lowercase host, no default port, no trailing slash. */
function parsePublicUrl(raw: string, ctx: RefinementContext): string {
  const url = parseUrl(raw, ctx);
  if (!url || !hasSecureOrigin(url, ctx)) {
    return z.NEVER;
  }
  if (url.pathname !== "/") {
    return fail(ctx, "must be an origin without a path (the MCP endpoint is served at /mcp)");
  }
  return url.origin;
}

/** The issuer is compared verbatim with the backend's metadata, so it must already be a bare origin. */
function parseIssuer(raw: string, ctx: RefinementContext): string {
  const url = parseUrl(raw, ctx);
  if (!url || !hasSecureOrigin(url, ctx)) {
    return z.NEVER;
  }
  if (url.origin !== raw) {
    return fail(ctx, `must not have a path or trailing slash and must equal the backend OAUTH_ISSUER_URL (e.g. "${url.origin}")`);
  }
  return raw;
}

function parseApiUrl(raw: string, ctx: RefinementContext): string {
  const url = parseUrl(raw, ctx);
  if (!url) {
    return z.NEVER;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return fail(ctx, "must be an absolute http or https URL");
  }
  if (url.username || url.password) {
    return fail(ctx, "must not contain credentials");
  }
  return url.href.replace(/\/+$/, "");
}

function parseAllowedHosts(raw: string | undefined, ctx: z.core.$RefinementCtx<string | undefined>): string[] {
  const hosts = (raw ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host !== "");
  for (const host of hosts) {
    if (!ALLOWED_HOST_PATTERN.test(host)) {
      ctx.addIssue({ code: "custom", input: raw, message: `entry "${host}" must be a hostname without scheme or port` });
    }
  }
  return hosts;
}

function allowedHostsOrDefault(hosts: string[]): string[] {
  return hosts.length > 0 ? hosts : DEVELOPMENT_ALLOWED_HOSTS;
}

function parseUrl(raw: string, ctx: RefinementContext): URL | undefined {
  if (!URL.canParse(raw)) {
    fail(ctx, "must be an absolute URL");
    return undefined;
  }
  if (raw.includes("?") || raw.includes("#")) {
    fail(ctx, "must not contain a query or fragment");
    return undefined;
  }
  return new URL(raw);
}

function hasSecureOrigin(url: URL, ctx: RefinementContext): boolean {
  if (url.username || url.password) {
    fail(ctx, "must not contain credentials");
    return false;
  }
  if (url.protocol === "https:" || (url.protocol === "http:" && LOOPBACK_HOSTNAMES.has(url.hostname))) {
    return true;
  }
  fail(ctx, "must use https (http is only allowed for localhost, 127.0.0.1 and [::1])");
  return false;
}

function fail(ctx: RefinementContext, message: string): never {
  ctx.addIssue({ code: "custom", input: ctx.value, message });
  return z.NEVER;
}
