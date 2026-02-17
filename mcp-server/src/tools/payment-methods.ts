import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiRequest } from "../client.js";
import type { PaymentMethod } from "../types.js";

export function registerPaymentMethodTools(server: McpServer): void {
  server.tool(
    "list-payment-methods",
    "List all user-defined payment methods (e.g. Cash, Credit Card, Bank Transfer).",
    {},
    async () => {
      const methods = await apiRequest<PaymentMethod[]>(
        "GET",
        "/payment-methods"
      );
      return {
        content: [
          { type: "text", text: JSON.stringify(methods, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "create-payment-method",
    "Create a new payment method.",
    {
      name: z.string().min(1).describe("Payment method name"),
    },
    async ({ name }) => {
      const method = await apiRequest<PaymentMethod>(
        "POST",
        "/payment-methods",
        { body: { name } }
      );
      return {
        content: [
          { type: "text", text: JSON.stringify(method, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "update-payment-method",
    "Rename an existing payment method.",
    {
      id: z
        .number()
        .int()
        .positive()
        .describe("Payment method ID to update"),
      name: z.string().min(1).describe("New name"),
    },
    async ({ id, name }) => {
      const method = await apiRequest<PaymentMethod>(
        "PATCH",
        `/payment-methods/${id}`,
        { body: { name } }
      );
      return {
        content: [
          { type: "text", text: JSON.stringify(method, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "delete-payment-method",
    "Delete a payment method by ID. Will fail if any records still reference it.",
    {
      id: z
        .number()
        .int()
        .positive()
        .describe("Payment method ID to delete"),
    },
    async ({ id }) => {
      await apiRequest<string>("DELETE", `/payment-methods/${id}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              message: "Payment method deleted successfully",
            }),
          },
        ],
      };
    }
  );
}
