import { z } from "zod/v4";
import type { ApiClient } from "../api/client.js";
import type { Category, Currency, FinancialRecord, PaymentMethod, Setting } from "../api/types.js";
import { defineTool } from "./definition.js";
import {
  amountSchema,
  categoryTypeSchema,
  CREATE,
  currencySchema,
  dayInput,
  dayTimestamp,
  DELETE,
  deletedReply,
  deletedSchema,
  idSchema,
  MIN_AMOUNT,
  paymentMethodIdsSchema,
  rangeEndInput,
  rangeStartInput,
  READ,
  requireChanges,
  searchSchema,
  SINCE_2_0_0,
  todayUtc,
  ToolError,
  UPDATE,
} from "./shared.js";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 500;
const NO_PAYMENT_METHODS_MESSAGE =
  "You have no payment methods yet. Create one with create_payment_method, then try again.";

export const recordSchema = z.object({
  id: z.number().int(),
  categoryId: z.number().int(),
  paymentMethodId: z.number().int(),
  amount: z.number(),
  currency: currencySchema,
  description: z.string().nullable(),
  date: z.string(),
  recurringExpenseId: z.number().int().nullable(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});

const listedRecordSchema = recordSchema.extend({
  categoryName: z.string().nullable(),
  categoryType: categoryTypeSchema.nullable(),
  paymentMethodName: z.string().nullable(),
});

const recordResultSchema = z.object({ record: recordSchema });

const recordIdSchema = idSchema("Record ID from list_records.");

const descriptionInput = z.string().describe("Short description, e.g. the merchant or purpose.");

export const listRecords = defineTool({
  name: "list_records",
  title: "List records",
  description:
    "Lists income and expense records, newest first by default, each with its category name and type and its payment method name. " +
    `Amounts are in each record's own currency. Returns at most limit records (default ${DEFAULT_LIST_LIMIT}) ` +
    "together with the total number that matched; filter by date range, category, payment methods or text to narrow the result. " +
    'Date filters are calendar days in UTC, and "today" from get_profile is the UTC date: for ranges such as today or this month, ' +
    "pass the user's local dates (YYYY-MM-DD) when you know them.",
  inputSchema: z.object({
    startDate: rangeStartInput("Only include records on or after this date (00:00:00 UTC for a date-only value).").optional(),
    endDate: rangeEndInput("Only include records on or before this date (23:59:59 UTC for a date-only value).").optional(),
    categoryId: idSchema("Only include records in this category (ID from list_categories).").optional(),
    paymentMethodIds: paymentMethodIdsSchema.optional(),
    search: searchSchema("Case-insensitive text matched against record descriptions and category names.").optional(),
    sortBy: z.enum(["date", "amount"]).optional().describe("Sort field; default date."),
    sortOrder: z.enum(["asc", "desc"]).optional().describe("Sort direction; default desc."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_LIST_LIMIT)
      .default(DEFAULT_LIST_LIMIT)
      .describe(`Maximum number of records to return (default ${DEFAULT_LIST_LIMIT}, max ${MAX_LIST_LIMIT}).`),
  }),
  outputSchema: z.object({
    records: z.array(listedRecordSchema),
    total: z.number().int(),
    returned: z.number().int(),
    truncated: z.boolean(),
  }),
  annotations: READ,
  covers: ["GET /api/v1/records", "GET /api/v1/categories", "GET /api/v1/payment-methods"],
  since: SINCE_2_0_0,
  async handler({ limit, ...filters }, api) {
    const [records, categories, paymentMethods] = await Promise.all([
      api.get<FinancialRecord[]>("/records", filters),
      api.get<Category[]>("/categories"),
      api.get<PaymentMethod[]>("/payment-methods"),
    ]);
    const categoriesById = new Map(categories.map((category) => [category.id, category]));
    const paymentMethodsById = new Map(paymentMethods.map((paymentMethod) => [paymentMethod.id, paymentMethod]));
    const listed = records.slice(0, limit).map((record) => ({
      ...record,
      categoryName: categoriesById.get(record.categoryId)?.name ?? null,
      categoryType: categoriesById.get(record.categoryId)?.type ?? null,
      paymentMethodName: paymentMethodsById.get(record.paymentMethodId)?.name ?? null,
    }));
    const truncated = records.length > listed.length;
    return {
      data: { records: listed, total: records.length, returned: listed.length, truncated },
      summary: truncated
        ? `Showing the first ${listed.length} of ${records.length} matching records. ` +
          `Narrow the filters or raise limit (max ${MAX_LIST_LIMIT}) to see more.`
        : undefined,
    };
  },
});

export const getRecord = defineTool({
  name: "get_record",
  title: "Get record",
  description: "Returns one income or expense record by ID.",
  inputSchema: z.object({ id: recordIdSchema }),
  outputSchema: recordResultSchema,
  annotations: READ,
  covers: ["GET /api/v1/records/:id"],
  since: SINCE_2_0_0,
  async handler({ id }, api) {
    return { data: { record: await api.get<FinancialRecord>(`/records/${id}`) } };
  },
});

export const createRecord = defineTool({
  name: "create_record",
  title: "Create record",
  description:
    "Records an income or an expense; the category's type decides which. " +
    "Currency defaults to the user's display currency and payment method to the one used by the most recent record " +
    "(or the first payment method when there are no records yet). The date defaults to today in UTC, which can be a day off " +
    "from the user's local date: pass the user's local date (YYYY-MM-DD) as date when you know it. " +
    "The result lists the defaults that were applied.",
  inputSchema: z.object({
    categoryId: idSchema("Category ID from list_categories."),
    amount: amountSchema(`Amount in the record's currency, at least ${MIN_AMOUNT}.`),
    currency: currencySchema.optional().describe("Currency of the amount; defaults to the user's display currency."),
    date: dayInput("Day of the transaction; defaults to today in UTC, so pass the user's local date when you know it.").optional(),
    paymentMethodId: idSchema(
      "Payment method ID from list_payment_methods; defaults to the payment method of the most recent record.",
    ).optional(),
    description: descriptionInput.optional(),
  }),
  outputSchema: z.object({
    record: recordSchema,
    defaultsApplied: z.object({
      currency: currencySchema.optional(),
      date: z.string().optional(),
      paymentMethodId: z.number().int().optional(),
    }),
  }),
  annotations: CREATE,
  covers: ["POST /api/v1/records", "GET /api/v1/settings", "GET /api/v1/records", "GET /api/v1/payment-methods"],
  since: SINCE_2_0_0,
  async handler(input, api) {
    const [currency, defaultMethod] = await Promise.all([
      input.currency ?? displayCurrency(api),
      input.paymentMethodId ? undefined : defaultPaymentMethod(api),
    ]);
    const today = todayUtc();
    const record = await api.post<FinancialRecord>("/records", {
      ...input,
      currency,
      paymentMethodId: input.paymentMethodId ?? defaultMethod?.id,
      date: input.date ?? dayTimestamp(today),
    });
    const defaultsApplied = {
      currency: input.currency ? undefined : currency,
      date: input.date ? undefined : today,
      paymentMethodId: defaultMethod?.id,
    };
    return { data: { record, defaultsApplied }, summary: describeDefaults(defaultsApplied, defaultMethod?.source) };
  },
});

export const updateRecord = defineTool({
  name: "update_record",
  title: "Update record",
  description: "Changes an income or expense record; only the fields you pass change.",
  inputSchema: requireChanges(
    z.object({
      id: recordIdSchema,
      categoryId: idSchema("New category ID from list_categories.").optional(),
      paymentMethodId: idSchema("New payment method ID from list_payment_methods.").optional(),
      amount: amountSchema(`New amount, at least ${MIN_AMOUNT}.`).optional(),
      currency: currencySchema.optional().describe("New currency of the amount."),
      description: z.string().optional().describe("New description; an empty string removes it."),
      date: dayInput("New day of the transaction.").optional(),
    }),
  ),
  outputSchema: recordResultSchema,
  annotations: UPDATE,
  covers: ["PATCH /api/v1/records/:id"],
  since: SINCE_2_0_0,
  async handler({ id, ...changes }, api) {
    return { data: { record: await api.patch<FinancialRecord>(`/records/${id}`, changes) } };
  },
});

export const deleteRecord = defineTool({
  name: "delete_record",
  title: "Delete record",
  description: "Deletes an income or expense record.",
  inputSchema: z.object({ id: recordIdSchema }),
  outputSchema: deletedSchema,
  annotations: DELETE,
  covers: ["DELETE /api/v1/records/:id"],
  since: SINCE_2_0_0,
  async handler({ id }, api) {
    await api.delete(`/records/${id}`);
    return deletedReply(id);
  },
});

async function displayCurrency(api: ApiClient): Promise<Currency> {
  return (await api.get<Setting>("/settings")).currency;
}

interface DefaultPaymentMethod {
  id: number;
  source: string;
}

/** The payment method of the most recent record, else the first payment method; there is none to pick for a new user. */
async function defaultPaymentMethod(api: ApiClient): Promise<DefaultPaymentMethod> {
  const [latest] = await api.get<FinancialRecord[]>("/records", { sortBy: "date", sortOrder: "desc" });
  if (latest) {
    return { id: latest.paymentMethodId, source: "used by the most recent record" };
  }
  const [first] = await api.get<PaymentMethod[]>("/payment-methods");
  if (first) {
    return { id: first.id, source: "the first payment method" };
  }
  throw new ToolError(NO_PAYMENT_METHODS_MESSAGE);
}

function describeDefaults(
  defaults: { currency?: Currency; date?: string; paymentMethodId?: number },
  paymentMethodSource: string | undefined,
): string | undefined {
  const applied = [
    defaults.currency && `currency ${defaults.currency} (the display currency)`,
    defaults.date && `date ${defaults.date} (today, UTC)`,
    defaults.paymentMethodId && `payment method ${defaults.paymentMethodId} (${paymentMethodSource})`,
  ].filter(Boolean);
  return applied.length > 0 ? `Applied defaults: ${applied.join(", ")}.` : undefined;
}
