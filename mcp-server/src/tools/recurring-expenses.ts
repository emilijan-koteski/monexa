import { z } from "zod/v4";
import type { RecurringExpense } from "../api/types.js";
import { defineTool } from "./definition.js";
import {
  CREATE,
  currencySchema,
  dayInput,
  DELETE,
  deletedReply,
  deletedSchema,
  frequencySchema,
  idSchema,
  READ,
  requireChanges,
  SINCE_2_0_0,
  UPDATE,
} from "./shared.js";

const MIN_AMOUNT = 0.01;

const recurringExpenseSchema = z.object({
  id: z.number().int(),
  categoryId: z.number().int(),
  paymentMethodId: z.number().int(),
  amount: z.number(),
  currency: currencySchema,
  description: z.string().nullable(),
  frequency: frequencySchema,
  startDate: z.string(),
  endDate: z.string().nullable(),
  isActive: z.boolean(),
  nextRunDate: z.string(),
  lastGeneratedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});

const recurringExpenseResultSchema = z.object({ recurringExpense: recurringExpenseSchema });

const recurringExpenseIdSchema = idSchema("Recurring expense ID from list_recurring_expenses.");

const recurringAmountSchema = z.number().min(MIN_AMOUNT);

export const listRecurringExpenses = defineTool({
  name: "list_recurring_expenses",
  title: "List recurring expenses",
  description:
    "Lists the user's recurring expenses (e.g. rent or subscriptions) with amount, currency, frequency, start and end dates, " +
    "whether each is active and nextRunDate, the next day a record will be added for it.",
  inputSchema: z.object({}),
  outputSchema: z.object({ recurringExpenses: z.array(recurringExpenseSchema) }),
  annotations: READ,
  covers: ["GET /api/v1/recurring-expenses"],
  since: SINCE_2_0_0,
  async handler(_input, api) {
    return { data: { recurringExpenses: await api.get<RecurringExpense[]>("/recurring-expenses") } };
  },
});

export const createRecurringExpense = defineTool({
  name: "create_recurring_expense",
  title: "Create recurring expense",
  description:
    "Creates a recurring expense that adds a record automatically on every due day: DAILY, WEEKLY, MONTHLY or YEARLY from the start date. " +
    "The start date cannot be in the past; when it is today, the first record is added immediately.",
  inputSchema: z.object({
    categoryId: idSchema("Category ID from list_categories."),
    paymentMethodId: idSchema("Payment method ID from list_payment_methods."),
    amount: recurringAmountSchema.describe(`Amount of each occurrence, at least ${MIN_AMOUNT}.`),
    currency: currencySchema.describe("Currency of the amount."),
    frequency: frequencySchema.describe("How often a record is added."),
    startDate: dayInput("First due day; today or later."),
    endDate: dayInput("Last day a record may be added; omit to repeat indefinitely.").optional(),
    description: z.string().optional().describe("Description copied to every generated record."),
  }),
  outputSchema: recurringExpenseResultSchema,
  annotations: CREATE,
  covers: ["POST /api/v1/recurring-expenses"],
  since: SINCE_2_0_0,
  async handler(input, api) {
    return { data: { recurringExpense: await api.post<RecurringExpense>("/recurring-expenses", input) } };
  },
});

export const updateRecurringExpense = defineTool({
  name: "update_recurring_expense",
  title: "Update recurring expense",
  description:
    "Changes a recurring expense; only the fields you pass change. Set isActive to false to pause it and to true to resume it; " +
    "resuming continues from the next due day without adding records for the days missed while paused. " +
    "Set clearEndDate to true to make it repeat indefinitely. Records it already added are not changed.",
  inputSchema: requireChanges(
    z.object({
      id: recurringExpenseIdSchema,
      categoryId: idSchema("New category ID from list_categories.").optional(),
      paymentMethodId: idSchema("New payment method ID from list_payment_methods.").optional(),
      amount: recurringAmountSchema.optional().describe(`New amount of each occurrence, at least ${MIN_AMOUNT}.`),
      currency: currencySchema.optional().describe("New currency of the amount."),
      frequency: frequencySchema.optional().describe("New frequency."),
      description: z.string().optional().describe("New description; an empty string removes it."),
      startDate: dayInput("New first due day; today or later.").optional(),
      endDate: dayInput("New last day a record may be added.").optional(),
      clearEndDate: z.boolean().optional().describe("true removes the end date."),
      isActive: z.boolean().optional().describe("false pauses the recurring expense, true resumes it."),
    }),
  ).refine((input) => !(input.clearEndDate && input.endDate), "Pass either endDate or clearEndDate, not both."),
  outputSchema: recurringExpenseResultSchema,
  annotations: UPDATE,
  covers: ["PATCH /api/v1/recurring-expenses/:id"],
  since: SINCE_2_0_0,
  async handler({ id, ...changes }, api) {
    return { data: { recurringExpense: await api.patch<RecurringExpense>(`/recurring-expenses/${id}`, changes) } };
  },
});

export const deleteRecurringExpense = defineTool({
  name: "delete_recurring_expense",
  title: "Delete recurring expense",
  description: "Deletes a recurring expense so it adds no more records. Records it already added are kept.",
  inputSchema: z.object({ id: recurringExpenseIdSchema }),
  outputSchema: deletedSchema,
  annotations: DELETE,
  covers: ["DELETE /api/v1/recurring-expenses/:id"],
  since: SINCE_2_0_0,
  async handler({ id }, api) {
    await api.delete(`/recurring-expenses/${id}`);
    return deletedReply(id);
  },
});
