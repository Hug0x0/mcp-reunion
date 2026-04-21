// src/modules/index.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerEmploymentTools } from './employment.js';
import { registerEnvironmentTools } from './environment.js';
import { registerFacilityTools } from './facilities.js';
import { registerTourismTools } from './tourism.js';
import { registerTransportTools } from './transport.js';
import { registerWeatherTools } from './weather.js';

export const TOOL_COUNT = 13;

/**
 * Register all tool modules with the MCP server.
 */
export function registerAllTools(server: McpServer): void {
  registerEmploymentTools(server);
  registerEnvironmentTools(server);
  registerFacilityTools(server);
  registerTourismTools(server);
  registerTransportTools(server);
  registerWeatherTools(server);
}
