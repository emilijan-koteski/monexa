export const ACCESS_TOKEN_EXPIRY_DAYS = [30, 90, 365] as const;
export const DEFAULT_ACCESS_TOKEN_EXPIRY_DAYS = 90;
export const ACCESS_TOKEN_NAME_MAX_LENGTH = 50;
export const MAX_ACTIVE_ACCESS_TOKENS = 10;

export const MCP_TOKEN_ENV_VARIABLE = 'MONEXA_TOKEN';

const MCP_SERVER_NAME = 'monexa';
const JSON_INDENT = 2;
const VS_CODE_TOKEN_INPUT_ID = 'monexa-token';
const VS_CODE_TOKEN_INPUT_DESCRIPTION = 'Monexa access token';

export const buildHeaderSnippet = (token: string): string => `Authorization: Bearer ${token}`;

export const buildClaudeCodeSnippet = (mcpUrl: string, token: string): string =>
  `claude mcp add --transport http ${MCP_SERVER_NAME} ${mcpUrl} --header "${buildHeaderSnippet(token)}"`;

const toIndentedJson = (value: unknown): string => JSON.stringify(value, null, JSON_INDENT);

export const buildCursorSnippet = (mcpUrl: string): string =>
  toIndentedJson({
    mcpServers: {
      [MCP_SERVER_NAME]: { url: mcpUrl, headers: { Authorization: `Bearer \${env:${MCP_TOKEN_ENV_VARIABLE}}` } },
    },
  });

export const buildVsCodeSnippet = (mcpUrl: string): string =>
  toIndentedJson({
    inputs: [
      {
        type: 'promptString',
        id: VS_CODE_TOKEN_INPUT_ID,
        description: VS_CODE_TOKEN_INPUT_DESCRIPTION,
        password: true,
      },
    ],
    servers: {
      [MCP_SERVER_NAME]: {
        type: 'http',
        url: mcpUrl,
        headers: { Authorization: `Bearer \${input:${VS_CODE_TOKEN_INPUT_ID}}` },
      },
    },
  });

export const countCharacters = (value: string): number => Array.from(value).length;
