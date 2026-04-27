// src/modules/telecom.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, pickNumber, pickString, quote } from '../utils/helpers.js';

const DATASET_5G = 'sites-mobiles-5g-a-la-reunion';
const DATASET_FTTH = 'arcep_regions';

export function registerTelecomTools(server: McpServer): void {
  server.tool(
    'reunion_list_5g_sites',
    'List mobile 5G cell sites deployed across La Réunion, sourced from ARCEP open data (the French telecoms regulator). Each row is one operator-station combination. Returns operator name, operator site ID, ANFR station ID, active frequency bands (MHz), commercial-release date for 5G service, commune, EPCI. Useful for coverage analysis, infrastructure mapping, operator comparison, real-estate / connectivity studies.',
    {
      operator: z.string().optional().describe('Operator name prefix match. Examples: "Orange", "SFR", "Bouygues Telecom", "Free Mobile"'),
      commune: z.string().optional().describe('Commune name prefix match'),
      frequency: z.string().optional().describe('Frequency band substring match. Examples: "700" (700 MHz), "2100" (2.1 GHz), "3500" (3.5 GHz, the main 5G band)'),
      limit: z.number().int().min(1).max(500).default(100).describe('Max sites to return (1-500, default 100)'),
    },
    async ({ operator, commune, frequency, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_5G, {
          where: buildWhere([
            operator ? `op_name LIKE ${quote(`${operator}%`)}` : undefined,
            commune ? `com_name LIKE ${quote(`${commune}%`)}` : undefined,
            frequency ? `frequency LIKE ${quote(`%${frequency}%`)}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_sites: data.total_count,
          sites: data.results.map((row) => ({
            operator: pickString(row, ['op_name']),
            site_id: pickString(row, ['op_site_id']),
            anfr_station_id: pickString(row, ['anfr_station_id']),
            frequency_bands_mhz: pickString(row, ['frequency']),
            commercial_release: pickString(row, ['release_date_5g']),
            commune: pickString(row, ['com_name']),
            epci: pickString(row, ['epci_name']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch 5G sites');
      }
    }
  );

  server.tool(
    'reunion_get_ftth_coverage',
    'FTTH (Fiber to the Home) deployment coverage for La Réunion region, from ARCEP regional dashboards. Each row is one observation period. Returns: period, total housing units, total businesses, IPE premises (T3 2022 sum across all OIs), best premise estimate (T2 2022), coverage rate %, deployment notes. Useful for digital-divide analysis, infrastructure rollout monitoring, telecom-investment tracking.',
    {},
    async () => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_FTTH, {
          where: `nom_region = ${quote('La Réunion')}`,
          limit: 20,
        });
        return jsonResult({
          total_rows: data.total_count,
          coverage: data.results.map((row) => ({
            period: pickString(row, ['periode']),
            housing_total: pickNumber(row, ['logements']),
            businesses_total: pickNumber(row, ['etablissements']),
            ipe_premises_t3_2022: pickNumber(row, ['nombre_locaux_ipe_t3_2022_somme_tous_oi']),
            best_estimate_t2_2022: pickNumber(row, ['meilleure_estimation_des_locaux_t2_2022']),
            coverage_rate_pct: pickNumber(row, ['taux_de_couverture']),
            deployments: pickString(row, ['deploiements']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch FttH coverage');
      }
    }
  );
}
