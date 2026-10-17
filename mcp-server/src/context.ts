import type { AuthInfo } from "@modelcontextprotocol/server";
import { ApiError, createApiClient, type ApiClient } from "./api/client.js";
import type { Config } from "./config.js";

const API_PATH = "/api/v1";
const MISSING_AUTH_MESSAGE = "This request is not authenticated with Monexa; reconnect the app.";

export interface TokenCache {
  evict(token: string): void;
}

/** Process-wide dependencies shared by every per-request MCP server instance. */
export interface AppContext {
  config: Config;
  tokenCache: TokenCache;
}

/** Builds an API client for one tool call from the AuthInfo the bearer middleware attached to its HTTP request. */
export function apiClientFor(ctx: AppContext, authInfo: AuthInfo | undefined): ApiClient {
  const apiToken = authInfo?.extra?.apiToken;
  if (!authInfo || typeof apiToken !== "string") {
    throw new ApiError(401, MISSING_AUTH_MESSAGE);
  }
  return createApiClient({
    baseUrl: ctx.config.apiUrl + API_PATH,
    token: apiToken,
    onUnauthorized: () => ctx.tokenCache.evict(authInfo.token),
  });
}
