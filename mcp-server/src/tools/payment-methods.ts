import { z } from "zod/v4";
import type { PaymentMethod } from "../api/types.js";
import { defineTool } from "./definition.js";
import { CREATE, DELETE, deletedReply, deletedSchema, idSchema, nameSchema, READ, SINCE_2_0_0, UPDATE } from "./shared.js";

const paymentMethodSchema = z.object({
  id: z.number().int(),
  name: z.string(),
});

const paymentMethodResultSchema = z.object({ paymentMethod: paymentMethodSchema });

const paymentMethodIdSchema = idSchema("Payment method ID from list_payment_methods.");

export const listPaymentMethods = defineTool({
  name: "list_payment_methods",
  title: "List payment methods",
  description:
    "Lists the user's payment methods (e.g. Cash, Credit Card, Bank Transfer) with their IDs. Every record and recurring expense has one payment method.",
  inputSchema: z.object({}),
  outputSchema: z.object({ paymentMethods: z.array(paymentMethodSchema) }),
  annotations: READ,
  covers: ["GET /api/v1/payment-methods"],
  since: SINCE_2_0_0,
  async handler(_input, api) {
    return { data: { paymentMethods: await api.get<PaymentMethod[]>("/payment-methods") } };
  },
});

export const createPaymentMethod = defineTool({
  name: "create_payment_method",
  title: "Create payment method",
  description: "Creates a payment method. Returns the new payment method with its ID.",
  inputSchema: z.object({ name: nameSchema("Payment method name, e.g. Credit Card.") }),
  outputSchema: paymentMethodResultSchema,
  annotations: CREATE,
  covers: ["POST /api/v1/payment-methods"],
  since: SINCE_2_0_0,
  async handler(input, api) {
    return { data: { paymentMethod: await api.post<PaymentMethod>("/payment-methods", input) } };
  },
});

export const updatePaymentMethod = defineTool({
  name: "update_payment_method",
  title: "Rename payment method",
  description: "Renames a payment method.",
  inputSchema: z.object({ id: paymentMethodIdSchema, name: nameSchema("New name.") }),
  outputSchema: paymentMethodResultSchema,
  annotations: UPDATE,
  covers: ["PATCH /api/v1/payment-methods/:id"],
  since: SINCE_2_0_0,
  async handler({ id, name }, api) {
    return { data: { paymentMethod: await api.patch<PaymentMethod>(`/payment-methods/${id}`, { name }) } };
  },
});

export const deletePaymentMethod = defineTool({
  name: "delete_payment_method",
  title: "Delete payment method",
  description:
    "Deletes a payment method. Monexa refuses while any record still uses it; move those records to another payment method or delete them first.",
  inputSchema: z.object({ id: paymentMethodIdSchema }),
  outputSchema: deletedSchema,
  annotations: DELETE,
  covers: ["DELETE /api/v1/payment-methods/:id"],
  since: SINCE_2_0_0,
  async handler({ id }, api) {
    await api.delete(`/payment-methods/${id}`);
    return deletedReply(id);
  },
});
