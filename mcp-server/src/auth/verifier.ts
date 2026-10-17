import { createHash } from "node:crypto";
import { OAuthError, OAuthErrorCode, type AuthInfo, type OAuthTokenVerifier } from "@modelcontextprotocol/server";
import { LRUCache } from "lru-cache";
import { errorMessage, log } from "../log.js";
import { USER_AGENT } from "../version.js";

const TOKEN_PATH = "/oauth/token";
const TOKEN_EXCHANGE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:token-exchange";
const ACCESS_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token";
const EXCHANGEABLE_TOKEN_PREFIXES = ["mnx_at_", "mnx_pat_"];
const PAT_CLIENT_ID = "pat";
const INVALID_GRANT = "invalid_grant";
const INVALID_TOKEN_MESSAGE = "The access token is invalid or expired";
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_CACHE_ENTRIES = 1_000;
const CACHE_EXPIRY_MARGIN_SECONDS = 60;
const MAX_CACHE_TTL_SECONDS = 240;
const MILLISECONDS_PER_SECOND = 1_000;

export interface TokenExchangeVerifierOptions {
  apiUrl: string;
  clientId: string;
  clientSecret: string;
  resourceUrl: string;
  timeoutMs?: number;
  maxCacheEntries?: number;
  fetch?: typeof fetch;
}

interface DelegatedToken {
  accessToken: string;
  expiresIn: number;
  scope: string;
}

interface CachedExchange {
  authInfo: AuthInfo;
  freshUntil: number;
}

/** The backend could not be asked about a token (network error, timeout, 5xx or rejected client credentials). */
export class UpstreamUnavailableError extends Error {
  override name = "UpstreamUnavailableError";
}

/**
 * Verifies Monexa OAuth access tokens and PATs by exchanging them (RFC 8693) for a short-lived delegated API JWT.
 * Results are cached per token digest so a conversation does not exchange on every request.
 */
export class TokenExchangeVerifier implements OAuthTokenVerifier {
  private readonly cache: LRUCache<string, CachedExchange>;
  private readonly inFlight = new Map<string, Promise<AuthInfo>>();
  private readonly tokenUrl: string;
  private readonly clientAuthorization: string;
  private readonly resourceUrl: string;
  private readonly timeoutMs: number;
  private readonly fetch: typeof fetch;

  constructor(options: TokenExchangeVerifierOptions) {
    this.cache = new LRUCache({ max: options.maxCacheEntries ?? DEFAULT_MAX_CACHE_ENTRIES });
    this.tokenUrl = options.apiUrl + TOKEN_PATH;
    this.clientAuthorization = basicAuthorization(options.clientId, options.clientSecret);
    this.resourceUrl = options.resourceUrl;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetch = options.fetch ?? ((input, init) => fetch(input, init));
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    if (!EXCHANGEABLE_TOKEN_PREFIXES.some((prefix) => token.startsWith(prefix))) {
      throw new OAuthError(OAuthErrorCode.InvalidToken, INVALID_TOKEN_MESSAGE);
    }
    const key = cacheKey(token);
    return this.freshCachedAuthInfo(key) ?? this.inFlight.get(key) ?? this.startExchange(key, token);
  }

  /** Forgets a token's cached exchange, e.g. after the API rejected its delegated JWT. */
  evict(token: string): void {
    this.cache.delete(cacheKey(token));
  }

  private freshCachedAuthInfo(key: string): AuthInfo | undefined {
    const cached = this.cache.get(key);
    if (cached && cached.freshUntil <= Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    return cached?.authInfo;
  }

  private startExchange(key: string, token: string): Promise<AuthInfo> {
    const pending = this.exchange(token)
      .then((delegated) => {
        const authInfo = this.toAuthInfo(token, delegated);
        const ttlSeconds = Math.min(delegated.expiresIn - CACHE_EXPIRY_MARGIN_SECONDS, MAX_CACHE_TTL_SECONDS);
        if (ttlSeconds > 0) {
          this.cache.set(key, { authInfo, freshUntil: Date.now() + ttlSeconds * MILLISECONDS_PER_SECOND });
        }
        return authInfo;
      })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, pending);
    return pending;
  }

  private async exchange(token: string): Promise<DelegatedToken> {
    let status: number;
    let body: unknown;
    try {
      const response = await this.fetch(this.tokenUrl, {
        method: "POST",
        headers: {
          Authorization: this.clientAuthorization,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
        body: new URLSearchParams({
          grant_type: TOKEN_EXCHANGE_GRANT_TYPE,
          subject_token: token,
          subject_token_type: ACCESS_TOKEN_TYPE,
          resource: this.resourceUrl,
        }).toString(),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      status = response.status;
      body = await response.json().catch(() => undefined);
    } catch (error) {
      log("error", "token_exchange_unreachable", { error: errorMessage(error) });
      throw new UpstreamUnavailableError("The Monexa backend could not be reached");
    }
    return interpretExchangeResponse(status, body);
  }

  private toAuthInfo(token: string, delegated: DelegatedToken): AuthInfo {
    return {
      token,
      clientId: delegatedClientId(delegated.accessToken),
      scopes: delegated.scope.split(" ").filter((scope) => scope !== ""),
      expiresAt: Math.floor(Date.now() / MILLISECONDS_PER_SECOND) + delegated.expiresIn,
      resource: new URL(this.resourceUrl),
      extra: { apiToken: delegated.accessToken },
    };
  }
}

function interpretExchangeResponse(status: number, body: unknown): DelegatedToken {
  if (status === 200) {
    const delegated = parseDelegatedToken(body);
    if (delegated) {
      return delegated;
    }
    log("error", "token_exchange_malformed_response", { status });
    throw new UpstreamUnavailableError("The Monexa backend returned an unexpected token response");
  }
  const errorCode = oauthErrorCode(body);
  if (status === 400 && errorCode === INVALID_GRANT) {
    throw new OAuthError(OAuthErrorCode.InvalidToken, INVALID_TOKEN_MESSAGE);
  }
  if (status === 401) {
    log("error", "token_exchange_client_rejected", {
      status,
      error: errorCode,
      message: "The backend rejected the MCP client credentials; MCP_CLIENT_ID and MCP_CLIENT_SECRET must match the backend.",
    });
  } else {
    log("error", "token_exchange_failed", { status, error: errorCode });
  }
  throw new UpstreamUnavailableError(`The Monexa backend answered the token exchange with status ${status}`);
}

function parseDelegatedToken(body: unknown): DelegatedToken | undefined {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }
  const { access_token: accessToken, expires_in: expiresIn, scope } = body as Record<string, unknown>;
  if (typeof accessToken !== "string" || accessToken === "" || typeof expiresIn !== "number" || !(expiresIn > 0)) {
    return undefined;
  }
  return { accessToken, expiresIn, scope: typeof scope === "string" ? scope : "" };
}

function oauthErrorCode(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }
  const { error } = body as Record<string, unknown>;
  return typeof error === "string" ? error : undefined;
}

/** Reads the clientId claim without verifying the signature: the backend minted the JWT over a trusted channel. */
function delegatedClientId(jwt: string): string {
  try {
    const payload: unknown = JSON.parse(Buffer.from(jwt.split(".")[1] ?? "", "base64url").toString("utf8"));
    const clientId = (payload as Record<string, unknown> | null)?.clientId;
    return typeof clientId === "string" && clientId !== "" ? clientId : PAT_CLIENT_ID;
  } catch {
    return PAT_CLIENT_ID;
  }
}

/** HTTP Basic credentials with both parts form-urlencoded first, as RFC 6749 section 2.3.1 requires. */
function basicAuthorization(clientId: string, clientSecret: string): string {
  const credentials = `${formUrlEncode(clientId)}:${formUrlEncode(clientSecret)}`;
  return `Basic ${Buffer.from(credentials, "utf8").toString("base64")}`;
}

function formUrlEncode(value: string): string {
  return encodeURIComponent(value).replaceAll("%20", "+");
}

function cacheKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
