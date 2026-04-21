// src/modules/index.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerAdministrationTools } from './administration.js';
import { registerCompanyTools } from './companies.js';
import { registerEmploymentTools } from './employment.js';
import { registerWeatherTools } from './weather.js';
import { registerMiningTools } from './mining.js';
import { registerEnvironmentTools } from './environment.js';
import { registerGeographyTools } from './geography.js';
import { registerPopulationTools } from './population.js';
import { registerTourismTools } from './tourism.js';
import { registerTransportTools } from './transport.js';

export const TOOL_COUNT = 29;

/**
 * Register all tool modules with the MCP server
 */
export function registerAllTools(server: McpServer): void {
  registerAdministrationTools(server);
  registerCompanyTools(server);
  registerEmploymentTools(server);
  registerWeatherTools(server);
  registerMiningTools(server);
  registerEnvironmentTools(server);
  registerGeographyTools(server);
  registerPopulationTools(server);
  registerTourismTools(server);
  registerTransportTools(server);
}
