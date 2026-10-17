type LogLevel = "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

/** Writes one JSON line per event; callers must never pass tokens or tool arguments. */
export function log(level: LogLevel, event: string, fields: LogFields = {}): void {
  const line = JSON.stringify({ time: new Date().toISOString(), level, event, ...fields });
  if (level === "info") {
    console.log(line);
  } else {
    console.error(line);
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
