import type { CallToolResult, McpServer, ServerContext } from "@modelcontextprotocol/server";
import type { ApiClient } from "../api/client.js";
import { apiClientFor, type AppContext } from "../context.js";
import { log } from "../log.js";
import { createCategory, deleteCategory, listCategories, updateCategory } from "./categories.js";
import type { ToolDefinition } from "./definition.js";
import { createPaymentMethod, deletePaymentMethod, listPaymentMethods, updatePaymentMethod } from "./payment-methods.js";
import { getProfile } from "./profile.js";
import { createRecord, deleteRecord, getRecord, listRecords, updateRecord } from "./records.js";
import {
  createRecurringExpense,
  deleteRecurringExpense,
  listRecurringExpenses,
  updateRecurringExpense,
} from "./recurring-expenses.js";
import { updateSettings } from "./settings.js";
import { toError, toResult, ToolError } from "./shared.js";
import { getSpendingSummary } from "./summary.js";
import { getTrendReportData, listTrendReports } from "./trend-reports.js";

export type { ToolDefinition } from "./definition.js";

const UNEXPECTED_SHAPE_MESSAGE = "Monexa returned data in an unexpected shape; try again later.";

export const toolDefinitions: readonly ToolDefinition[] = [
  getProfile,
  listCategories,
  listPaymentMethods,
  listRecords,
  getRecord,
  getSpendingSummary,
  listRecurringExpenses,
  listTrendReports,
  getTrendReportData,
  createRecord,
  updateRecord,
  deleteRecord,
  createCategory,
  updateCategory,
  deleteCategory,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  createRecurringExpense,
  updateRecurringExpense,
  deleteRecurringExpense,
  updateSettings,
];

/** Registers every tool in catalog order. */
export function registerAllTools(server: McpServer, ctx: AppContext): void {
  for (const tool of toolDefinitions) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        annotations: tool.annotations,
      },
      (input, extra) => runTool(tool, ctx, input, extra),
    );
  }
}

/** Calls the handler with an API client bound to the request's delegated JWT and returns its output or an actionable error. */
async function runTool(
  tool: ToolDefinition,
  ctx: AppContext,
  input: Record<string, unknown>,
  extra: ServerContext,
): Promise<CallToolResult> {
  try {
    const api = withSignal(apiClientFor(ctx, extra.http?.authInfo), extra.mcpReq.signal);
    const reply = await tool.handler(input, api);
    const output = tool.outputSchema.safeParse(reply.data);
    if (!output.success) {
      const issues = output.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.code}`);
      log("error", "tool_output_mismatch", { tool: tool.name, issues });
      return toError(new ToolError(UNEXPECTED_SHAPE_MESSAGE));
    }
    return toResult(output.data, reply.summary);
  } catch (error) {
    return toError(error, tool.name);
  }
}

/** Cancels the tool's REST calls when the MCP client cancels the tool call. */
function withSignal(api: ApiClient, signal: AbortSignal): ApiClient {
  return {
    get: (path, query, options) => api.get(path, query, { signal, ...options }),
    post: (path, body, options) => api.post(path, body, { signal, ...options }),
    patch: (path, body, options) => api.patch(path, body, { signal, ...options }),
    delete: (path, options) => api.delete(path, { signal, ...options }),
  };
}
