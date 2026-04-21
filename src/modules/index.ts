// src/modules/index.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerEmploymentTools } from './employment.js';
import { registerTransportTools } from './transport.js';
import { registerWeatherTools } from './weather.js';

export const TOOL_COUNT = 7;

/**
 * Register all tool modules with the MCP server.
 */
export function registerAllTools(server: McpServer): void {
  registerEmploymentTools(server);
  registerTransportTools(server);
  registerWeatherTools(server);
}
