// src/modules/index.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerCatalogTools } from './catalog.js';
import { registerEducationTools } from './education.js';
import { registerEmploymentTools } from './employment.js';
import { registerEnvironmentTools } from './environment.js';
import { registerFacilityTools } from './facilities.js';
import { registerHealthTools } from './health.js';
import { registerHospitalityTools } from './hospitality.js';
import { registerHousingTools } from './housing.js';
import { registerSocialTools } from './social.js';
import { registerPossessionTools } from './possession.js';
import { registerTelecomTools } from './telecom.js';
import { registerTourismTools } from './tourism.js';
import { registerTransportTools } from './transport.js';
import { registerUrbanismTools } from './urbanism.js';
import { registerWeatherTools } from './weather.js';

export const TOOL_COUNT = 40;

/**
 * Register all tool modules with the MCP server.
 */
export function registerAllTools(server: McpServer): void {
  registerCatalogTools(server);
  registerEducationTools(server);
  registerEmploymentTools(server);
  registerEnvironmentTools(server);
  registerFacilityTools(server);
  registerHealthTools(server);
  registerHospitalityTools(server);
  registerHousingTools(server);
  registerPossessionTools(server);
  registerSocialTools(server);
  registerTelecomTools(server);
  registerTourismTools(server);
  registerTransportTools(server);
  registerUrbanismTools(server);
  registerWeatherTools(server);
}
