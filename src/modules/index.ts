// src/modules/index.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { registerAdministrationTools } from './administration.js';
import { registerCatalogTools } from './catalog.js';
import { registerCommuneTools } from './commune.js';
import { registerCultureTools } from './culture.js';
import { registerEconomyTools } from './economy.js';
import { registerEducationTools } from './education.js';
import { registerEmploymentTools } from './employment.js';
import { registerEnvironmentTools } from './environment.js';
import { registerFacilityTools } from './facilities.js';
import { registerGeographyTools } from './geography.js';
import { registerHealthTools } from './health.js';
import { registerHospitalityTools } from './hospitality.js';
import { registerHousingTools } from './housing.js';
import { registerPossessionTools } from './possession.js';
import { registerSocialTools } from './social.js';
import { registerTelecomTools } from './telecom.js';
import { registerTerritoryTools } from './territory.js';
import { registerTourismTools } from './tourism.js';
import { registerTransportTools } from './transport.js';
import { registerUrbanismTools } from './urbanism.js';
import { registerWeatherTools } from './weather.js';

export const TOOL_COUNT = 96;

/**
 * Register all tool modules with the MCP server.
 */
export function registerAllTools(server: McpServer): void {
  registerAdministrationTools(server);
  registerCatalogTools(server);
  registerCommuneTools(server);
  registerCultureTools(server);
  registerEconomyTools(server);
  registerEducationTools(server);
  registerEmploymentTools(server);
  registerEnvironmentTools(server);
  registerFacilityTools(server);
  registerGeographyTools(server);
  registerHealthTools(server);
  registerHospitalityTools(server);
  registerHousingTools(server);
  registerPossessionTools(server);
  registerSocialTools(server);
  registerTelecomTools(server);
  registerTerritoryTools(server);
  registerTourismTools(server);
  registerTransportTools(server);
  registerUrbanismTools(server);
  registerWeatherTools(server);
}
