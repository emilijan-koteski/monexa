import { z } from "zod/v4";
import type { Setting } from "../api/types.js";
import { defineTool } from "./definition.js";
import { currencySchema, languageSchema, requireChanges, SINCE_2_0_0, UPDATE } from "./shared.js";

export const settingsSchema = z.object({
  currency: currencySchema.describe("Display currency used for summaries, statistics and trend reports."),
  language: languageSchema.describe("App language: EN (English) or MK (Macedonian)."),
});

export const updateSettings = defineTool({
  name: "update_settings",
  title: "Update settings",
  description:
    "Changes the user's display currency, the app language, or both. The display currency is used for summaries, statistics " +
    "and trend reports and is create_record's default currency; existing records keep their own currencies.",
  inputSchema: requireChanges(
    z.object({
      currency: currencySchema.optional().describe("New display currency."),
      language: languageSchema.optional().describe("New app language: EN (English) or MK (Macedonian)."),
    }),
  ),
  outputSchema: z.object({ settings: settingsSchema }),
  annotations: UPDATE,
  covers: ["PATCH /api/v1/settings"],
  since: SINCE_2_0_0,
  async handler(input, api) {
    return { data: { settings: await api.patch<Setting>("/settings", input) } };
  },
});
