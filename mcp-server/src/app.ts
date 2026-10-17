import { fileURLToPath } from "node:url";
import { createMcpExpressApp, mcpAuthMetadataRouter } from "@modelcontextprotocol/express";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler, type OAuthMetadata, type OAuthTokenVerifier } from "@modelcontextprotocol/server";
import express, { type Express, type RequestHandler, type Router } from "express";
import { requireMonexaBearer, SUPPORTED_SCOPES } from "./auth/bearer.js";
import type { Config } from "./config.js";
import type { AppContext, TokenCache } from "./context.js";
import { log } from "./log.js";
import { buildServer, PNG_ICON_PATH, SVG_ICON_PATH } from "./server.js";
import { sendTemporarilyUnavailable } from "./unavailable.js";
import { VERSION } from "./version.js";

const MCP_PATH = "/mcp";
const HEALTH_PATH = "/healthz";
const OPENAI_APPS_CHALLENGE_PATH = "/.well-known/openai-apps-challenge";
const RESOURCE_NAME = "Monexa";
const ICON_MAX_AGE = "7d";
const MAX_LOGGED_NAME_LENGTH = 64;
const SVG_ICON_FILE = fileURLToPath(new URL("../assets/icon.svg", import.meta.url));
const PNG_ICON_FILE = fileURLToPath(new URL("../assets/icon-512.png", import.meta.url));

export interface CreateAppOptions {
  config: Config;
  verifier: OAuthTokenVerifier & TokenCache;
}

export interface McpApp {
  app: Express;
  useAuthorizationServerMetadata(metadata: OAuthMetadata): void;
  close(): Promise<void>;
}

/**
 * Builds the HTTP app; until the backend's authorization server metadata is supplied, everything except
 * /healthz answers 503. /healthz sits outside host validation so container probes on 127.0.0.1 reach it.
 */
export function createApp({ config, verifier }: CreateAppOptions): McpApp {
  const ctx: AppContext = { config, tokenCache: verifier };
  const mcpHandler = createMcpHandler(() => buildServer(ctx), {
    onerror: (error) => log("error", "mcp_handler_error", { error: error.message }),
  });
  const serveMcp = toNodeHandler(mcpHandler, {
    onerror: (error) => log("error", "mcp_adapter_error", { error: error.message }),
  });
  let metadataRouter: Router | undefined;

  const mcpApp = createMcpExpressApp({ host: "0.0.0.0", allowedHosts: config.allowedHosts });
  mcpApp.disable("x-powered-by");
  mcpApp.use(serveMetadataOnceLoaded(() => metadataRouter));
  if (config.openaiAppsChallengeToken) {
    const challengeToken = config.openaiAppsChallengeToken;
    mcpApp.get(OPENAI_APPS_CHALLENGE_PATH, (_req, res) => {
      res.type("text/plain").send(challengeToken);
    });
  }
  mcpApp.get(SVG_ICON_PATH, serveIcon(SVG_ICON_FILE));
  mcpApp.get(PNG_ICON_PATH, serveIcon(PNG_ICON_FILE));
  mcpApp.all(
    MCP_PATH,
    logMcpRequests(),
    requireMonexaBearer({ verifier, resourceUrl: config.resourceUrl }),
    (req, res) => serveMcp(req, res, req.body),
  );

  const app = express();
  app.disable("x-powered-by");
  app.get(HEALTH_PATH, (_req, res) => {
    res.status(metadataRouter ? 200 : 503).json({ status: metadataRouter ? "ok" : "starting", version: VERSION });
  });
  app.use(mcpApp);

  return {
    app,
    useAuthorizationServerMetadata(metadata) {
      metadataRouter = mcpAuthMetadataRouter({
        oauthMetadata: metadata,
        resourceServerUrl: new URL(config.resourceUrl),
        scopesSupported: SUPPORTED_SCOPES,
        resourceName: RESOURCE_NAME,
      });
    },
    close: () => mcpHandler.close(),
  };
}

/** Serves the discovery documents once loaded and answers every request with 503 until then. */
function serveMetadataOnceLoaded(currentRouter: () => Router | undefined): RequestHandler {
  return (req, res, next) => {
    const router = currentRouter();
    if (!router) {
      sendTemporarilyUnavailable(res, "The Monexa MCP server is starting.");
      return;
    }
    router(req, res, next);
  };
}

function serveIcon(file: string): RequestHandler {
  return (_req, res, next) => {
    res.sendFile(file, { maxAge: ICON_MAX_AGE }, (error) => {
      if (error) {
        next(error);
      }
    });
  };
}

/** Logs one JSON line per /mcp request with its JSON-RPC method, tool name, status, duration and client; never tokens or arguments. */
function logMcpRequests(): RequestHandler {
  return (req, res, next) => {
    const startedAt = performance.now();
    res.on("close", () => {
      log("info", "mcp_request", {
        httpMethod: req.method,
        rpcMethod: rpcMethod(req.body),
        tool: toolName(req.body),
        status: res.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
        clientId: req.auth?.clientId,
      });
    });
    next();
  };
}

function rpcMethod(body: unknown): string | undefined {
  if (Array.isArray(body)) {
    return "batch";
  }
  const method = (body as { method?: unknown } | undefined)?.method;
  return typeof method === "string" ? method.slice(0, MAX_LOGGED_NAME_LENGTH) : undefined;
}

function toolName(body: unknown): string | undefined {
  if (rpcMethod(body) !== "tools/call") {
    return undefined;
  }
  const name = (body as { params?: { name?: unknown } }).params?.name;
  return typeof name === "string" ? name.slice(0, MAX_LOGGED_NAME_LENGTH) : undefined;
}
