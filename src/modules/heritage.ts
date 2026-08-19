// src/modules/heritage.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, pickNumber, pickString, pickValue, quote } from '../utils/helpers.js';

const DATASET_UNESCO_PERIMETERS = 'pnrun_unesco_perimetre';
const DATASET_UNESCO_VALUE_CONTRIBUTIONS = 'pnrun_unesco_contribvue_vii';

interface GeoPoint {
  lat?: number;
  lon?: number;
}

function pickGeoPoint(row: RecordObject): GeoPoint | undefined {
  const point = pickValue<Record<string, unknown>>(row, ['geo_point_2d']);
  if (!point || typeof point !== 'object') {
    return undefined;
  }

  const lat = point.lat;
  const lon = point.lon;
  return {
    lat: typeof lat === 'number' ? lat : undefined,
    lon: typeof lon === 'number' ? lon : undefined,
  };
}

export function registerHeritageTools(server: McpServer): void {
  server.tool(
    'reunion_list_unesco_perimeters',
    'List UNESCO World Heritage perimeters for La Réunion National Park, including the listed property and buffer zone. Returns perimeter code, type, surface, and centroid only; full geometries are intentionally omitted because they are very large. Useful for heritage, conservation, tourism, and land-use analysis around the Pitons, cirques and remparts.',
    {
      type: z.string().optional().describe('Perimeter type prefix match. Examples: "Bien", "Zone tampon"'),
      limit: z.number().int().min(1).max(100).default(20).describe('Max perimeters to return (1-100, default 20)'),
    },
    async ({ type, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_UNESCO_PERIMETERS, {
          where: buildWhere([type ? `type LIKE ${quote(`${type}%`)}` : undefined]),
          limit,
        });

        return jsonResult({
          total_perimeters: data.total_count,
          perimeters: data.results.map((row) => ({
            code: pickNumber(row, ['code']),
            type: pickString(row, ['type']),
            surface_m2: pickNumber(row, ['surf']),
            centroid: pickGeoPoint(row),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to list UNESCO perimeters');
      }
    }
  );

  server.tool(
    'reunion_list_unesco_value_contributions',
    'List landscape units contributing to UNESCO Outstanding Universal Value criterion vii for La Réunion. Returns unit names, sub-units, contribution label/code, surface, and centroid while omitting full geometries. Useful for explaining why the island is listed as World Heritage and for heritage-aware tourism or environmental planning.',
    {
      unit: z.string().optional().describe('Landscape unit prefix match, e.g. "Piton", "Cirque", "Rempart"'),
      contribution: z.number().int().optional().describe('Numeric contribution code from the source dataset'),
      limit: z.number().int().min(1).max(200).default(50).describe('Max contributions to return (1-200, default 50)'),
    },
    async ({ unit, contribution, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_UNESCO_VALUE_CONTRIBUTIONS, {
          where: buildWhere([
            unit ? `nom_up LIKE ${quote(`${unit}%`)}` : undefined,
            contribution !== undefined ? `contrib = ${contribution}` : undefined,
          ]),
          limit,
        });

        return jsonResult({
          total_contributions: data.total_count,
          contributions: data.results.map((row) => ({
            unit: pickString(row, ['nom_up']),
            subunit: pickString(row, ['nom_ssuni']),
            contribution_label: pickString(row, ['contrib_vu']),
            contribution_code: pickNumber(row, ['contrib']),
            subunit_code: pickString(row, ['numssunite']),
            surface_m2: pickNumber(row, ['surf']),
            centroid: pickGeoPoint(row),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to list UNESCO value contributions');
      }
    }
  );
}
