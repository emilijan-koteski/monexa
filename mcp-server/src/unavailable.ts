import type { Response } from "express";

const RETRY_AFTER_SECONDS = "5";

/** Answers 503 `temporarily_unavailable` with Retry-After, so clients retry instead of re-authenticating. */
export function sendTemporarilyUnavailable(res: Response, description: string): void {
  res.status(503).set("Retry-After", RETRY_AFTER_SECONDS).json({
    error: "temporarily_unavailable",
    error_description: description,
  });
}
