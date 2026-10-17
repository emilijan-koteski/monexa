import { z } from "zod/v4";
import type { CategoryStatistics } from "../api/types.js";
import { defineTool } from "./definition.js";
import {
  categoryTypeSchema,
  currencySchema,
  currentMonthRangeUtc,
  paymentMethodIdsSchema,
  rangeEndInput,
  rangeStartInput,
  READ,
  searchSchema,
  SINCE_2_0_0,
} from "./shared.js";

const categoryTotalSchema = z.object({
  categoryId: z.number().int(),
  categoryName: z.string(),
  categoryType: categoryTypeSchema,
  color: z.string().nullable(),
  recordCount: z.number().int(),
  totalAmount: z.number(),
});

export const getSpendingSummary = defineTool({
  name: "get_spending_summary",
  title: "Get spending summary",
  description:
    "Totals income, expenses and the net balance (income minus expenses) for a period, with each category's record count and total. " +
    "All amounts are converted to the user's display currency at the exchange rate of each record's date. " +
    "Without startDate and endDate it covers the current calendar month in UTC.",
  inputSchema: z.object({
    startDate: rangeStartInput("Start of the period, inclusive (00:00:00 UTC for a date-only value).").optional(),
    endDate: rangeEndInput("End of the period, inclusive (23:59:59 UTC for a date-only value).").optional(),
    paymentMethodIds: paymentMethodIdsSchema.optional(),
    search: searchSchema.optional(),
  }),
  outputSchema: z.object({
    period: z.object({ startDate: z.string().nullable(), endDate: z.string().nullable() }),
    currency: currencySchema,
    totalIncome: z.number(),
    totalExpense: z.number(),
    netBalance: z.number(),
    categories: z.array(categoryTotalSchema),
  }),
  annotations: READ,
  covers: ["GET /api/v1/categories/statistics"],
  since: SINCE_2_0_0,
  async handler({ startDate, endDate, ...filters }, api) {
    const period =
      startDate || endDate ? { startDate: startDate ?? null, endDate: endDate ?? null } : currentMonthRangeUtc();
    const statistics = await api.get<CategoryStatistics>("/categories/statistics", {
      ...filters,
      startDate: period.startDate ?? undefined,
      endDate: period.endDate ?? undefined,
    });
    return { data: { period, ...statistics } };
  },
});
