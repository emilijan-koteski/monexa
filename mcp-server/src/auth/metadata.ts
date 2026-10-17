import { setTimeout as delay } from "node:timers/promises";
import type { OAuthMetadata } from "@modelcontextprotocol/server";
import { errorMessage, log } from "../log.js";
import { USER_AGENT } from "../version.js";

const METADATA_PATH = "/.well-known/oauth-authorization-server";
const DEFAULT_ATTEMPTS = 30;
const DEFAULT_RETRY_DELAY_MS = 2_000;
const DEFAULT_TIMEOUT_MS = 5_000;

export interface LoadAuthorizationServerMetadataOptions {
  apiUrl: string;
  issuer: string;
  attempts?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

/** The backend's metadata names another issuer than MONEXA_OAUTH_ISSUER; retrying cannot fix that. */
export class IssuerMismatchError extends Error {
  override name = "IssuerMismatchError";
}

/**
 * Fetches the backend's RFC 8414 metadata over the internal network so the mirror served here matches it exactly.
 * Unreachable or failing backends are retried; an issuer mismatch fails immediately.
 */
export async function loadAuthorizationServerMetadata(
  options: LoadAuthorizationServerMetadataOptions,
): Promise<OAuthMetadata> {
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  const url = options.apiUrl + METADATA_PATH;
  let lastError = "no attempt made";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fetchMetadata(url, options);
    } catch (error) {
      if (error instanceof IssuerMismatchError) {
        throw error;
      }
      lastError = errorMessage(error);
      log("warn", "authorization_server_metadata_unavailable", { attempt, attempts, error: lastError });
    }
    if (attempt < attempts) {
      await delay(options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS);
    }
  }
  throw new Error(`Could not load ${url} after ${attempts} attempts: ${lastError}`);
}

async function fetchMetadata(url: string, options: LoadAuthorizationServerMetadataOptions): Promise<OAuthMetadata> {
  const fetchImpl = options.fetch ?? fetch;
  const response = await fetchImpl(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`status ${response.status}`);
  }
  const metadata: unknown = await response.json();
  const issuer = (metadata as { issuer?: unknown } | null)?.issuer;
  if (typeof issuer !== "string") {
    throw new Error("the response is not an authorization server metadata document");
  }
  if (issuer !== options.issuer) {
    throw new IssuerMismatchError(
      `The backend's issuer "${issuer}" does not match MONEXA_OAUTH_ISSUER "${options.issuer}"; set both to the same public URL.`,
    );
  }
  return metadata as OAuthMetadata;
}
