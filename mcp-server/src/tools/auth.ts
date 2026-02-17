import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { login, register } from "../auth.js";

export function registerAuthTools(server: McpServer): void {
  server.tool(
    "login",
    "Log in to Monexa with email and password. Returns user profile and stores auth tokens for subsequent tool calls.",
    {
      email: z.string().email().describe("Account email address"),
      password: z.string().min(1).describe("Account password"),
    },
    async ({ email, password }) => {
      const data = await login(email, password);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                message: "Login successful",
                user: data.user,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.tool(
    "register",
    "Create a new Monexa account. Returns the created user profile and automatically logs in.",
    {
      email: z.string().email().describe("Email address for the new account"),
      password: z.string().min(1).describe("Password for the new account"),
      name: z.string().min(1).describe("Display name for the user"),
    },
    async ({ email, password, name }) => {
      const data = await register(email, password, name);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                message: "Registration successful",
                user: data.user,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
