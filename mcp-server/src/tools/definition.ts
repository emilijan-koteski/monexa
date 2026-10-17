import type { z } from "zod/v4";
import type { ApiClient } from "../api/client.js";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

/** A backend route as listed in docs/api-routes.json, e.g. `GET /api/v1/records/:id`. */
export type RouteKey = `${HttpMethod} /${string}`;

export interface ToolHints {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: false;
}

/** What a tool handler returns: data matching its output schema and an optional note for the model. */
export interface ToolReply<Data> {
  data: Data;
  summary?: string;
}

export interface ToolSpec<Input extends z.ZodObject, Output extends z.ZodObject> {
  name: string;
  title: string;
  description: string;
  inputSchema: Input;
  outputSchema: Output;
  annotations: ToolHints;
  covers: readonly RouteKey[];
  since: string;
  handler(input: z.output<Input>, api: ApiClient): Promise<ToolReply<z.input<Output>>>;
}

export type ToolDefinition = ToolSpec<z.ZodObject, z.ZodObject>;

/** Declares a tool with its input and output schemas typed against its handler. */
export function defineTool<Input extends z.ZodObject, Output extends z.ZodObject>(
  spec: ToolSpec<Input, Output>,
): ToolDefinition {
  return spec as unknown as ToolDefinition;
}
