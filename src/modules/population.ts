// src/modules/population.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { errorResult, jsonResult, pickNumber } from '../utils/helpers.js';

const DATASET_CENSUS = 'recensement-de-la-population-2019-individus-nc';

function provinceToCode(province: 'Sud' | 'Nord' | 'Iles'): string {
  return province === 'Iles' ? 'Iles' : province;
}

function ageBucket(age: number): string {
  if (age <= 14) return '0-14';
  if (age <= 24) return '15-24';
  if (age <= 39) return '25-39';
  if (age <= 59) return '40-59';
  if (age <= 74) return '60-74';
  return '75+';
}

export function registerPopulationTools(server: McpServer): void {
  /**
   * Get population statistics
   */
  server.tool(
    'nc_get_population_stats',
    'Get population statistics from the 2019 census of Réunion',
    {
      province: z
        .enum(['Sud', 'Nord', 'Iles'])
        .optional()
        .describe('Filter by province'),
      group_by: z
        .enum(['province', 'sexe', 'diplome', 'activite', 'transport_principal'])
        .default('province')
        .describe('How to group results'),
    },
    async ({ province, group_by }) => {
      try {
        const groupFieldMap: Record<string, string> = {
          province: 'prov',
          sexe: 'genre',
          diplome: 'dipl',
          activite: 'empl',
          transport_principal: 'trans',
        };

        const groupField = groupFieldMap[group_by];
        const where = province ? `prov = '${provinceToCode(province)}'` : undefined;

        const data = await client.getAggregates<RecordObject>(
          DATASET_CENSUS,
          `count(*) as count, ${groupField}`,
          { where, groupBy: groupField }
        );

        return jsonResult({
          census_year: 2019,
          province,
          grouped_by: group_by,
          source_field: groupField,
          statistics: data.results,
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to fetch population stats'
        );
      }
    }
  );

  /**
   * Get demographics by age group
   */
  server.tool(
    'nc_get_demographics_by_age',
    'Get demographic breakdown by age groups from the 2019 census',
    {
      province: z
        .enum(['Sud', 'Nord', 'Iles'])
        .optional()
        .describe('Filter by province'),
    },
    async ({ province }) => {
      try {
        const where = province ? `prov = '${provinceToCode(province)}'` : undefined;

        const data = await client.getAggregates<RecordObject>(
          DATASET_CENSUS,
          'count(*) as count, agea',
          {
            where,
            groupBy: 'agea',
          }
        );

        const buckets = new Map<string, number>([
          ['0-14', 0],
          ['15-24', 0],
          ['25-39', 0],
          ['40-59', 0],
          ['60-74', 0],
          ['75+', 0],
        ]);

        for (const row of data.results) {
          const age = pickNumber(row, ['agea']);
          const count = pickNumber(row, ['count']) ?? 0;
          if (age !== undefined) {
            const bucket = ageBucket(age);
            buckets.set(bucket, (buckets.get(bucket) ?? 0) + count);
          }
        }

        return jsonResult({
          census_year: 2019,
          province,
          age_groups: Array.from(buckets.entries()).map(([range, count]) => ({
            age_range: range,
            count,
          })),
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to fetch demographics'
        );
      }
    }
  );

  /**
   * Get transport mode statistics
   */
  server.tool(
    'nc_get_transport_modes',
    'Get statistics on transport modes used by the population (from 2019 census)',
    {
      province: z
        .enum(['Sud', 'Nord', 'Iles'])
        .optional()
        .describe('Filter by province'),
    },
    async ({ province }) => {
      try {
        const where = province ? `prov = '${provinceToCode(province)}'` : undefined;

        const data = await client.getAggregates<RecordObject>(
          DATASET_CENSUS,
          'count(*) as count, trans',
          { where, groupBy: 'trans' }
        );

        return jsonResult({
          census_year: 2019,
          province,
          source_field: 'trans',
          transport_modes: data.results,
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to fetch transport modes'
        );
      }
    }
  );
}
