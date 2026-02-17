import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiRequest } from "../client.js";
import type { FinancialRecord, RecordSummary } from "../types.js";

const currencyEnum = z.enum(["MKD", "EUR", "USD", "AUD", "CHF", "GBP"]);

export function registerRecordTools(server: McpServer): void {
  server.tool(
    "list-records",
    "List financial records with optional filters. Returns records sorted by date descending by default. Use list-categories and list-payment-methods to get valid filter IDs.",
    {
      startDate: z
        .string()
        .optional()
        .describe("Filter start date (YYYY-MM-DD)"),
      endDate: z
        .string()
        .optional()
        .describe("Filter end date (YYYY-MM-DD)"),
      categoryId: z.number().int().positive().optional().describe("Filter by category ID"),
      paymentMethodIds: z
        .array(z.number().int().positive())
        .optional()
        .describe("Filter by payment method IDs"),
      search: z
        .string()
        .optional()
        .describe("Search in record description or category name"),
      sortBy: z
        .enum(["date", "amount"])
        .optional()
        .describe("Sort field (default: date)"),
      sortOrder: z
        .enum(["asc", "desc"])
        .optional()
        .describe("Sort direction (default: desc)"),
    },
    async (input) => {
      const records = await apiRequest<FinancialRecord[]>("GET", "/records", {
        params: {
          startDate: input.startDate,
          endDate: input.endDate,
          categoryId: input.categoryId,
          paymentMethodIds: input.paymentMethodIds,
          search: input.search,
          sortBy: input.sortBy,
          sortOrder: input.sortOrder,
        },
      });
      return {
        content: [
          { type: "text", text: JSON.stringify(records, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "get-record",
    "Get a single financial record by its ID.",
    {
      id: z.number().int().positive().describe("Record ID"),
    },
    async ({ id }) => {
      const record = await apiRequest<FinancialRecord>(
        "GET",
        `/records/${id}`
      );
      return {
        content: [
          { type: "text", text: JSON.stringify(record, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "create-record",
    "Create a new financial record (income or expense). Use list-categories and list-payment-methods first to get valid IDs.",
    {
      categoryId: z.number().int().positive().describe("Category ID"),
      paymentMethodId: z
        .number()
        .int()
        .positive()
        .describe("Payment method ID"),
      amount: z.number().positive().describe("Amount (positive decimal)"),
      currency: currencyEnum.describe("Currency code"),
      description: z.string().optional().describe("Description of the transaction"),
      date: z.string().describe("Transaction date (YYYY-MM-DD or ISO 8601)"),
    },
    async (input) => {
      const record = await apiRequest<FinancialRecord>("POST", "/records", {
        body: input,
      });
      return {
        content: [
          { type: "text", text: JSON.stringify(record, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "update-record",
    "Update an existing financial record. Only provided fields are updated.",
    {
      id: z.number().int().positive().describe("Record ID to update"),
      categoryId: z.number().int().positive().optional(),
      paymentMethodId: z.number().int().positive().optional(),
      amount: z.number().positive().optional(),
      currency: currencyEnum.optional(),
      description: z.string().optional(),
      date: z.string().optional(),
    },
    async ({ id, ...body }) => {
      const record = await apiRequest<FinancialRecord>(
        "PATCH",
        `/records/${id}`,
        { body }
      );
      return {
        content: [
          { type: "text", text: JSON.stringify(record, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "delete-record",
    "Delete a financial record by ID.",
    {
      id: z.number().int().positive().describe("Record ID to delete"),
    },
    async ({ id }) => {
      await apiRequest<string>("DELETE", `/records/${id}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ message: "Record deleted successfully" }),
          },
        ],
      };
    }
  );

  server.tool(
    "get-records-summary",
    "Get a financial summary (net balance: income minus expenses) for an optional date range, converted to the user's preferred currency.",
    {
      startDate: z
        .string()
        .optional()
        .describe("Filter start date (YYYY-MM-DD)"),
      endDate: z
        .string()
        .optional()
        .describe("Filter end date (YYYY-MM-DD)"),
    },
    async (input) => {
      const summary = await apiRequest<RecordSummary>(
        "GET",
        "/records/summary",
        {
          params: {
            startDate: input.startDate,
            endDate: input.endDate,
          },
        }
      );
      return {
        content: [
          { type: "text", text: JSON.stringify(summary, null, 2) },
        ],
      };
    }
  );
}
