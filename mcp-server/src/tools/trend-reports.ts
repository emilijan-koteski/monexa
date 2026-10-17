import { z } from "zod/v4";
import type { TrendReport, TrendReportMonthlyData, TrendReportMonthlyDetails } from "../api/types.js";
import { categorySchema } from "./categories.js";
import { defineTool } from "./definition.js";
import { categoryTypeSchema, currencySchema, idSchema, READ, SINCE_2_0_0 } from "./shared.js";

const MIN_YEAR = 1;
const MAX_YEAR = 9999;

const trendReportSchema = z.object({
  id: z.number().int(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  color: z.string().nullable(),
  categories: z.array(categorySchema),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});

const monthlyDetailItemSchema = z.object({
  label: z.string(),
  categoryId: z.number().int(),
  categoryName: z.string(),
  amount: z.number(),
  isUngrouped: z.boolean(),
});

export const listTrendReports = defineTool({
  name: "list_trend_reports",
  title: "List trend reports",
  description:
    "Lists the user's trend reports. A trend report tracks a chosen set of categories month by month; " +
    "use get_trend_report_data with a report ID to read its numbers.",
  inputSchema: z.object({}),
  outputSchema: z.object({ trendReports: z.array(trendReportSchema) }),
  annotations: READ,
  covers: ["GET /api/v1/trend-reports"],
  since: SINCE_2_0_0,
  async handler(_input, api) {
    return { data: { trendReports: await api.get<TrendReport[]>("/trend-reports") } };
  },
});

export const getTrendReportData = defineTool({
  name: "get_trend_report_data",
  title: "Get trend report data",
  description:
    "Returns a trend report's totals for each month (1-12) of a year in the user's display currency. " +
    "When the included categories mix income and expense, a month's amount is income minus expenses; otherwise it is the total of that type. " +
    "With includeDetails it also returns each month's amounts grouped by category and record description (label), largest first; " +
    "records without a description share one entry per category with isUngrouped true.",
  inputSchema: z.object({
    id: idSchema("Trend report ID from list_trend_reports."),
    year: z
      .number()
      .int()
      .min(MIN_YEAR)
      .max(MAX_YEAR)
      .optional()
      .describe("Calendar year (UTC); defaults to the current year."),
    type: categoryTypeSchema.optional().describe("Only include the report's categories of this type."),
    includeDetails: z.boolean().default(false).describe("Also return the per-category breakdown of every month."),
  }),
  outputSchema: z.object({
    id: z.number().int(),
    year: z.number().int(),
    type: categoryTypeSchema.nullable(),
    currency: currencySchema,
    months: z.array(z.object({ month: z.number().int(), amount: z.number() })),
    details: z.array(z.object({ month: z.number().int(), items: z.array(monthlyDetailItemSchema) })).optional(),
  }),
  annotations: READ,
  covers: ["GET /api/v1/trend-reports/:id/monthly-data", "GET /api/v1/trend-reports/:id/monthly-details"],
  since: SINCE_2_0_0,
  async handler({ id, year = new Date().getUTCFullYear(), type, includeDetails }, api) {
    const query = { year, type };
    const [monthly, details] = await Promise.all([
      api.get<TrendReportMonthlyData>(`/trend-reports/${id}/monthly-data`, query),
      includeDetails ? api.get<TrendReportMonthlyDetails>(`/trend-reports/${id}/monthly-details`, query) : undefined,
    ]);
    return {
      data: {
        id,
        year: monthly.year,
        type: type ?? null,
        currency: monthly.currency,
        months: monthly.data,
        details: details?.data,
      },
    };
  },
});
