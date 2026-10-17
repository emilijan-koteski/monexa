import type { CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod/v4";
import { ApiError } from "../api/client.js";
import type { CategoryType, Currency, Frequency, Language } from "../api/types.js";
import { log } from "../log.js";
import type { ToolHints } from "./definition.js";

export const CURRENCIES = ["MKD", "EUR", "USD", "AUD", "CHF", "GBP"] as const satisfies readonly Currency[];
export const LANGUAGES = ["EN", "MK"] as const satisfies readonly Language[];
export const CATEGORY_TYPES = ["INCOME", "EXPENSE"] as const satisfies readonly CategoryType[];
export const FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const satisfies readonly Frequency[];

export const currencySchema = z.enum(CURRENCIES);
export const languageSchema = z.enum(LANGUAGES);
export const categoryTypeSchema = z.enum(CATEGORY_TYPES);
export const frequencySchema = z.enum(FREQUENCIES);

export const READ: ToolHints = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
export const CREATE: ToolHints = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
export const UPDATE: ToolHints = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };
export const DELETE: ToolHints = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };

export const SINCE_2_0_0 = "2.0.0";

export const MIN_AMOUNT = 0.01;

export const deletedSchema = z.object({ deleted: z.literal(true), id: z.number().int() });

export function deletedReply(id: number) {
  return { data: { deleted: true as const, id } };
}

const UNEXPECTED_FAILURE_MESSAGE = "Something went wrong while talking to Monexa; try again.";
const NO_CHANGES_MESSAGE = "Provide at least one field to change.";
const DATE_FORMAT = "YYYY-MM-DD or an RFC 3339 timestamp such as 2026-03-05T14:30:00Z";
const DATE_INPUT_PATTERN =
  /^\d{4}-\d{2}-\d{2}(T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,9})?(Z|[+-]([01]\d|2[0-3]):[0-5]\d))?$/;
const DATE_ONLY_LENGTH = "YYYY-MM-DD".length;
const DAY_TIME = "T12:00:00Z";
const START_OF_DAY = "T00:00:00Z";
const END_OF_DAY = "T23:59:59Z";

/** A failure the user can act on; its message is shown to the model as is. */
export class ToolError extends Error {
  override name = "ToolError";
}

export function idSchema(description: string) {
  return z.number().int().positive().describe(description);
}

export function nameSchema(description: string) {
  return z.string().trim().min(1, "must not be empty").describe(description);
}

export function amountSchema(description: string) {
  return z.number().min(MIN_AMOUNT).describe(description);
}

export const paymentMethodIdsSchema = z
  .array(z.number().int().positive())
  .describe("Only include records paid with one of these payment methods (IDs from list_payment_methods).");

export function searchSchema(description: string) {
  return z.string().trim().min(1, "must not be empty").describe(description);
}

/** Today's date in UTC as YYYY-MM-DD. */
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, DATE_ONLY_LENGTH);
}

/** The first and last instant of the current UTC month, as the RFC 3339 range-filter bounds Monexa expects. */
export function currentMonthRangeUtc(now: Date = new Date()): { startDate: string; endDate: string } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  return {
    startDate: todayUtc(new Date(Date.UTC(year, month, 1))) + START_OF_DAY,
    endDate: todayUtc(lastDay) + END_OF_DAY,
  };
}

/** A calendar day for a record or recurring expense; date-only input becomes 12:00 UTC on that day. */
export function dayInput(description: string) {
  return dateInput(description).transform((value) => withDefaultTime(value, DAY_TIME));
}

/** An inclusive range start; date-only input becomes 00:00:00 UTC. */
export function rangeStartInput(description: string) {
  return dateInput(description).transform((value) => withDefaultTime(value, START_OF_DAY));
}

/** An inclusive range end; date-only input becomes 23:59:59 UTC. */
export function rangeEndInput(description: string) {
  return dateInput(description).transform((value) => withDefaultTime(value, END_OF_DAY));
}

export function dayTimestamp(date: string): string {
  return withDefaultTime(date, DAY_TIME);
}

function dateInput(description: string) {
  return z
    .string()
    .trim()
    .regex(DATE_INPUT_PATTERN, `must be ${DATE_FORMAT}`)
    .refine(isCalendarDate, "is not a valid calendar date")
    .describe(`${description} Format: ${DATE_FORMAT}.`);
}

function withDefaultTime(value: string, time: string): string {
  return value.length === DATE_ONLY_LENGTH ? value + time : value;
}

function isCalendarDate(value: string): boolean {
  const [year, month, day] = value.slice(0, DATE_ONLY_LENGTH).split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Rejects an update that changes nothing, so the model gets a clear error instead of a no-op call. */
export function requireChanges<Schema extends z.ZodObject>(schema: Schema): Schema {
  return schema.refine(
    (input: Record<string, unknown>) => Object.entries(input).some(([key, value]) => key !== "id" && value !== undefined),
    NO_CHANGES_MESSAGE,
  );
}

/** Wraps structured data as a tool result, with the same data as JSON text for clients that ignore structuredContent. */
export function toResult(data: Record<string, unknown>, summaryText?: string): CallToolResult {
  const text = JSON.stringify(data);
  const json = { type: "text" as const, text };
  return {
    structuredContent: JSON.parse(text) as Record<string, unknown>,
    content: summaryText ? [{ type: "text", text: summaryText }, json] : [json],
  };
}

/** Turns a failure into a tool error result whose text tells the user what to do next. */
export function toError(error: unknown, toolName?: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: errorText(error, toolName) }] };
}

function errorText(error: unknown, toolName: string | undefined): string {
  if (error instanceof ApiError || error instanceof ToolError) {
    return error.message;
  }
  log("error", "tool_failed", { tool: toolName, error: error instanceof Error ? error.message : String(error) });
  return UNEXPECTED_FAILURE_MESSAGE;
}
