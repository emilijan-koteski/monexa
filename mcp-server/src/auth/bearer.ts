import {
  bearerAuthChallengeResponse,
  getOAuthProtectedResourceMetadataUrl,
  verifyBearerToken,
  type OAuthTokenVerifier,
} from "@modelcontextprotocol/server";
import type { RequestHandler } from "express";
import { errorMessage, log } from "../log.js";
import { UpstreamUnavailableError } from "./verifier.js";

export const SUPPORTED_SCOPES = ["monexa.read", "monexa.write"];

const RETRY_AFTER_SECONDS = "5";

export interface BearerAuthOptions {
  verifier: OAuthTokenVerifier;
  resourceUrl: string;
}

/**
 * Requires a Monexa access token or PAT and attaches the verified AuthInfo to `req.auth`.
 * Answers 503 instead of 401 when the backend is unreachable, so clients retry rather than re-authenticate.
 */
export function requireMonexaBearer(options: BearerAuthOptions): RequestHandler {
  const resource = new URL(options.resourceUrl);
  const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(resource);
  const verifyOptions = { verifier: options.verifier, resourceMetadataUrl, expectedResource: resource };
  const challengeOptions = { resourceMetadataUrl, requiredScopes: SUPPORTED_SCOPES };

  return async (req, res, next) => {
    try {
      req.auth = await verifyBearerToken(req.headers.authorization, verifyOptions);
    } catch (error) {
      if (error instanceof UpstreamUnavailableError) {
        res.status(503).set("Retry-After", RETRY_AFTER_SECONDS).json({
          error: "temporarily_unavailable",
          error_description: "Monexa is temporarily unavailable. Try again shortly.",
        });
        return;
      }
      const challenge = bearerAuthChallengeResponse(error, challengeOptions);
      if (challenge.status >= 500) {
        log("error", "bearer_verification_failed", { error: errorMessage(error) });
      }
      challenge.headers.forEach((value, name) => res.set(name, value));
      res.status(challenge.status).send(await challenge.text());
      return;
    }
    next();
  };
}
