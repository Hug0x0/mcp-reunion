// src/modules/environment.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, quote } from '../utils/helpers.js';

const DATASET_WATER_CATCHMENTS = 'captages-deau';
const DATASET_DRY_FOREST = 'foret-seche';
const DATASET_PIEZOMETERS = 'piezometres';
const DATASET_REEF_STATIONS =
  'stations-de-suivi-du-reseau-dobservation-des-recifs-coralliens-rorc';

async function getDatasetNote(datasetId: string): Promise<string | undefined> {
  const metadata = await client.getDatasetMetadata(datasetId);
  if (metadata?.has_records === false) {
    return 'The dataset is present in the catalog but currently exposes no tabular records through the Explore API.';
  }
  return undefined;
}

export function registerEnvironmentTools(server: McpServer): void {
  /**
   * Get water catchment points
   */
  server.tool(
    'nc_get_water_catchments',
    'Get water catchment points for drinking water supply in Réunion',
    {
      commune: z.string().optional().describe('Filter by commune'),
      usage: z.enum(['aep', 'prive']).optional().describe('Usage type: aep (public supply) or prive (private)'),
      limit: z.number().int().min(1).max(100).default(50).describe('Max results'),
    },
    async ({ commune, usage, limit }) => {
      try {
        const metadata = await client.getDatasetMetadata(DATASET_WATER_CATCHMENTS);
        if (metadata?.has_records === false) {
          return jsonResult({
            total_catchments: 0,
            catchments: [],
            note: await getDatasetNote(DATASET_WATER_CATCHMENTS),
          });
        }

        const data = await client.getRecords<RecordObject>(DATASET_WATER_CATCHMENTS, {
          where: buildWhere([
            commune ? `commune LIKE ${quote(`${commune}%`)}` : undefined,
            usage ? `type = ${quote(usage)}` : undefined,
          ]),
          limit,
        });

        return jsonResult({
          total_catchments: data.total_count,
          catchments: data.results,
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to fetch water catchments'
        );
      }
    }
  );

  /**
   * Get dry forest sites
   */
  server.tool(
    'nc_get_dry_forest_sites',
    'Get dry forest conservation sites in Réunion. The dry forest is an endemic ecosystem with many unique species.',
    {
      commune: z.string().optional().describe('Filter by commune'),
      fire_priority: z.boolean().optional().describe('Filter by fire priority sites'),
      limit: z.number().int().min(1).max(100).default(50).describe('Max results'),
    },
    async ({ commune, fire_priority, limit }) => {
      try {
        const metadata = await client.getDatasetMetadata(DATASET_DRY_FOREST);
        if (metadata?.has_records === false) {
          return jsonResult({
            total_sites: 0,
            dry_forest_sites: [],
            note: await getDatasetNote(DATASET_DRY_FOREST),
          });
        }

        const data = await client.getRecords<RecordObject>(DATASET_DRY_FOREST, {
          where: buildWhere([
            commune ? `commune LIKE ${quote(`${commune}%`)}` : undefined,
            fire_priority !== undefined ? `priorite_feu = ${fire_priority ? 1 : 0}` : undefined,
          ]),
          limit,
        });

        return jsonResult({
          total_sites: data.total_count,
          dry_forest_sites: data.results,
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to fetch dry forest sites'
        );
      }
    }
  );

  /**
   * Get piezometers (groundwater monitoring)
   */
  server.tool(
    'nc_get_piezometers',
    'Get piezometer locations for groundwater level monitoring',
    {
      commune: z.string().optional().describe('Filter by commune'),
      limit: z.number().int().min(1).max(100).default(50).describe('Max results'),
    },
    async ({ commune, limit }) => {
      try {
        const metadata = await client.getDatasetMetadata(DATASET_PIEZOMETERS);
        if (metadata?.has_records === false) {
          return jsonResult({
            total_piezometers: 0,
            piezometers: [],
            note: await getDatasetNote(DATASET_PIEZOMETERS),
          });
        }

        const data = await client.getRecords<RecordObject>(DATASET_PIEZOMETERS, {
          where: commune ? `commune LIKE ${quote(`${commune}%`)}` : undefined,
          limit,
        });

        return jsonResult({
          total_piezometers: data.total_count,
          piezometers: data.results,
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to fetch piezometers'
        );
      }
    }
  );

  /**
   * Get coral reef monitoring stations
   */
  server.tool(
    'nc_get_reef_stations',
    'Get coral reef observation network (RORC) monitoring stations. NC lagoon is a UNESCO World Heritage site.',
    {
      limit: z.number().int().min(1).max(100).default(50).describe('Max results'),
    },
    async ({ limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_REEF_STATIONS, {
          limit,
        });

        return jsonResult({
          total_stations: data.total_count,
          note:
            data.total_count === 0 ? await getDatasetNote(DATASET_REEF_STATIONS) : undefined,
          reef_stations: data.results,
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to fetch reef stations'
        );
      }
    }
  );
}
