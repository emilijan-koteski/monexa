import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getCachedUser, updateCachedUser } from "../auth.js";
import { apiRequest } from "../client.js";
import type { User } from "../types.js";

export function registerUserTools(server: McpServer): void {
  server.tool(
    "get-profile",
    "Get the current authenticated user's profile (id, name, email).",
    {},
    async () => {
      const user = getCachedUser();
      if (!user) {
        return {
          content: [
            {
              type: "text",
              text: "Not authenticated. Call the login or register tool first.",
            },
          ],
          isError: true,
        };
      }
      return {
        content: [
          { type: "text", text: JSON.stringify(user, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "update-profile",
    "Update the current user's display name.",
    {
      name: z.string().min(1).describe("New display name"),
    },
    async ({ name }) => {
      const user = await apiRequest<User>("PATCH", "/users", {
        body: { name },
      });
      updateCachedUser(user);
      return {
        content: [
          { type: "text", text: JSON.stringify(user, null, 2) },
        ],
      };
    }
  );
}
