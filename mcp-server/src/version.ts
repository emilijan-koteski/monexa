import { readFileSync } from "node:fs";

interface PackageManifest {
  version: string;
}

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as PackageManifest;

export const VERSION = manifest.version;

export const USER_AGENT = `monexa-mcp/${VERSION}`;
