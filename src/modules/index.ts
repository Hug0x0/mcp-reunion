// src/modules/index.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerEducationTools } from './education.js';
import { registerEmploymentTools } from './employment.js';
import { registerEnvironmentTools } from './environment.js';
import { registerFacilityTools } from './facilities.js';
import { registerHealthTools } from './health.js';
import { registerTelecomTools } from './telecom.js';
import { registerTourismTools } from './tourism.js';
import { registerTransportTools } from './transport.js';
import { registerWeatherTools } from './weather.js';

export const TOOL_COUNT = 19;

/**
 * Register all tool modules with the MCP server.
 */
export function registerAllTools(server: McpServer): void {
  registerEducationTools(server);
  registerEmploymentTools(server);
  registerEnvironmentTools(server);
  registerFacilityTools(server);
  registerHealthTools(server);
  registerTelecomTools(server);
  registerTourismTools(server);
  registerTransportTools(server);
  registerWeatherTools(server);
}
