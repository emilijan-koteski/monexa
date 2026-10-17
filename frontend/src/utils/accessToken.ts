export const ACCESS_TOKEN_EXPIRY_DAYS = [30, 90, 365] as const;
export const DEFAULT_ACCESS_TOKEN_EXPIRY_DAYS = 90;
export const ACCESS_TOKEN_NAME_MAX_LENGTH = 50;
export const MAX_ACTIVE_ACCESS_TOKENS = 10;

const MCP_SERVER_NAME = 'monexa';
const JSON_INDENT = 2;

export const buildHeaderSnippet = (token: string): string => `Authorization: Bearer ${token}`;

export const buildClaudeCodeSnippet = (mcpUrl: string, token: string): string =>
  `claude mcp add --transport http ${MCP_SERVER_NAME} ${mcpUrl} --header "${buildHeaderSnippet(token)}"`;

export const buildMcpJsonSnippet = (mcpUrl: string, token: string): string =>
  JSON.stringify(
    { mcpServers: { [MCP_SERVER_NAME]: { url: mcpUrl, headers: { Authorization: `Bearer ${token}` } } } },
    null,
    JSON_INDENT,
  );

export const countCharacters = (value: string): number => Array.from(value).length;
