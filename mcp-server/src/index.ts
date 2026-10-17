import type { Server } from "node:http";
import { createApp, type McpApp } from "./app.js";
import { loadAuthorizationServerMetadata } from "./auth/metadata.js";
import { TokenExchangeVerifier } from "./auth/verifier.js";
import { ConfigError, loadConfig } from "./config.js";
import { errorMessage, log } from "./log.js";
import { VERSION } from "./version.js";

const LISTEN_HOST = "0.0.0.0";
const SHUTDOWN_TIMEOUT_MS = 10_000;

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const verifier = new TokenExchangeVerifier({
    apiUrl: config.apiUrl,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    resourceUrl: config.resourceUrl,
  });
  const mcp = createApp({ config, verifier });
  const server = mcp.app.listen(config.port, LISTEN_HOST, (error?: Error) => {
    if (error) {
      exitWithError(error);
      return;
    }
    log("info", "listening", { version: VERSION, port: config.port, resource: config.resourceUrl });
  });
  shutDownOnSignals(server, mcp);

  const metadata = await loadAuthorizationServerMetadata({ apiUrl: config.apiUrl, issuer: config.oauthIssuer });
  mcp.useAuthorizationServerMetadata(metadata);
  log("info", "ready", { issuer: metadata.issuer });
}

/** Stops accepting connections, lets in-flight requests finish and exits; a stuck shutdown is forced after a timeout. */
function shutDownOnSignals(server: Server, mcp: McpApp): void {
  const shutDown = (signal: NodeJS.Signals) => {
    log("info", "shutting_down", { signal });
    setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
    server.close(() => {
      mcp.close().finally(() => process.exit(0));
    });
  };
  process.once("SIGTERM", shutDown);
  process.once("SIGINT", shutDown);
}

function exitWithError(error: unknown): never {
  if (error instanceof ConfigError) {
    console.error(error.message);
  } else {
    log("error", "startup_failed", { error: errorMessage(error) });
  }
  process.exit(1);
}

main().catch(exitWithError);
