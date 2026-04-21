// src/modules/tourism.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { TrailStage } from '../types.js';
import { errorResult, jsonResult, pickNumber, pickString } from '../utils/helpers.js';

const DATASET_GR_NORTH = 'gr-province-nord';

export function registerTourismTools(server: McpServer): void {
  /**
   * Get GR hiking trail stages
   */
  server.tool(
    'nc_get_gr_trail',
    'Get GR (Grande Randonnée) hiking trail information. NC has two famous long-distance trails.',
    {
      province: z
        .enum(['nord'])
        .default('nord')
        .describe('Province (currently only "nord" is available)'),
    },
    async ({ province }) => {
      try {
        const datasetId = province === 'nord' ? DATASET_GR_NORTH : DATASET_GR_NORTH;

        const data = await client.getRecords<TrailStage>(datasetId, {
          order_by: 'nom ASC',
          limit: 50,
        });

        return jsonResult({
          trail: `GR ${province.charAt(0).toUpperCase() + province.slice(1)}`,
          total_stages: data.total_count,
          stages: data.results.map((stage, index) => ({
            stage_number: pickNumber(stage as Record<string, unknown>, ['etape']) ?? index + 1,
            name: pickString(stage, ['nom']) ?? `Segment ${index + 1}`,
            start: pickString(stage, ['depart']),
            end: pickString(stage, ['arrivee']),
            distance_km:
              pickNumber(stage as Record<string, unknown>, ['distance_km']) ??
              ((pickNumber(stage as Record<string, unknown>, ['longueur']) ?? 0) / 1000),
            elevation_gain: pickNumber(stage as Record<string, unknown>, ['denivele_positif']),
            estimated_duration: pickString(stage, ['duree_estimee']),
          })),
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to fetch trail info'
        );
      }
    }
  );
}
