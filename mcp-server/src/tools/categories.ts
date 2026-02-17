import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiRequest } from "../client.js";
import type { Category, CategoryStatistics } from "../types.js";

export function registerCategoryTools(server: McpServer): void {
  server.tool(
    "list-categories",
    "List all user-defined categories. Returns both INCOME and EXPENSE types with their IDs, names, colors, and descriptions.",
    {},
    async () => {
      const categories = await apiRequest<Category[]>("GET", "/categories");
      return {
        content: [
          { type: "text", text: JSON.stringify(categories, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "create-category",
    "Create a new spending or income category.",
    {
      name: z.string().min(1).describe("Category name"),
      type: z
        .enum(["INCOME", "EXPENSE"])
        .describe("Category type: INCOME or EXPENSE"),
      description: z.string().optional().describe("Category description"),
      color: z
        .string()
        .optional()
        .describe("Hex color code, e.g. #FF5733"),
    },
    async (input) => {
      const category = await apiRequest<Category>("POST", "/categories", {
        body: input,
      });
      return {
        content: [
          { type: "text", text: JSON.stringify(category, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "update-category",
    "Update an existing category. Only provided fields are updated.",
    {
      id: z.number().int().positive().describe("Category ID to update"),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      color: z.string().optional(),
    },
    async ({ id, ...body }) => {
      const category = await apiRequest<Category>(
        "PATCH",
        `/categories/${id}`,
        { body }
      );
      return {
        content: [
          { type: "text", text: JSON.stringify(category, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "delete-category",
    "Delete a category by ID. Will fail if any records still reference this category.",
    {
      id: z.number().int().positive().describe("Category ID to delete"),
    },
    async ({ id }) => {
      await apiRequest<string>("DELETE", `/categories/${id}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              message: "Category deleted successfully",
            }),
          },
        ],
      };
    }
  );

  server.tool(
    "get-category-statistics",
    "Get spending and income statistics broken down by category. Includes total income, total expense, net balance, and per-category amounts. All amounts are converted to the user's preferred currency.",
    {
      startDate: z
        .string()
        .optional()
        .describe("Filter start date (YYYY-MM-DD)"),
      endDate: z
        .string()
        .optional()
        .describe("Filter end date (YYYY-MM-DD)"),
      paymentMethodIds: z
        .array(z.number().int().positive())
        .optional()
        .describe("Filter by payment method IDs"),
      search: z.string().optional().describe("Search filter"),
    },
    async (input) => {
      const stats = await apiRequest<CategoryStatistics>(
        "GET",
        "/categories/statistics",
        {
          params: {
            startDate: input.startDate,
            endDate: input.endDate,
            paymentMethodIds: input.paymentMethodIds,
            search: input.search,
          },
        }
      );
      return {
        content: [
          { type: "text", text: JSON.stringify(stats, null, 2) },
        ],
      };
    }
  );
}
