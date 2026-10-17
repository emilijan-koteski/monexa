import { z } from "zod/v4";
import type { Setting, User } from "../api/types.js";
import { defineTool } from "./definition.js";
import { READ, SINCE_2_0_0, todayUtc } from "./shared.js";
import { settingsSchema } from "./settings.js";

export const getProfile = defineTool({
  name: "get_profile",
  title: "Get profile",
  description:
    "Returns the signed-in user's name and email, their settings (display currency and app language) and today's date in UTC (YYYY-MM-DD), " +
    "which is the date create_record uses by default.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    user: z.object({ id: z.number().int(), name: z.string(), email: z.string() }),
    settings: settingsSchema,
    today: z.string().describe("Today's date in UTC (YYYY-MM-DD); it can be a day off from the user's local date."),
  }),
  annotations: READ,
  covers: ["GET /api/v1/users/me", "GET /api/v1/settings"],
  since: SINCE_2_0_0,
  async handler(_input, api) {
    const [user, settings] = await Promise.all([api.get<User>("/users/me"), api.get<Setting>("/settings")]);
    return { data: { user, settings, today: todayUtc() } };
  },
});
