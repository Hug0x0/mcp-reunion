// src/modules/transport.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, pickNumber, pickString, quote } from '../utils/helpers.js';

const DATASET_TRAFFIC = 'trafic-mja-rn-lareunion';
const DATASET_ROAD_CLASS = 'rn-classement-fonctionnel-lareunion';
const DATASET_CYCLE = 'voie-velo-regionale';

export function registerTransportTools(server: McpServer): void {
  server.tool(
    'reunion_get_road_traffic',
    'Get average daily traffic (TMJA) counts on Réunion national roads.',
    {
      route: z.string().optional().describe('Route code filter, e.g. "RN1", "RN2"'),
      year: z.number().int().optional().describe('Reference year of the count'),
      commune: z.string().optional().describe('Commune filter (prefix match)'),
      limit: z.number().int().min(1).max(500).default(50),
    },
    async ({ route, year, commune, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_TRAFFIC, {
          where: buildWhere([
            route ? `route = ${quote(route)}` : undefined,
            year !== undefined ? `annee = ${year}` : undefined,
            commune ? `commune LIKE ${quote(`${commune}%`)}` : undefined,
          ]),
          order_by: 'annee DESC, tmja DESC',
          limit,
        });

        return jsonResult({
          total_segments: data.total_count,
          segments: data.results.map((row) => ({
            route: pickString(row, ['route']),
            year: pickNumber(row, ['annee']),
            tmja_vehicles_per_day: pickNumber(row, ['tmja']),
            heavy_vehicles_count: pickString(row, ['nb_pl']),
            heavy_vehicles_pct: pickString(row, ['pourcentag']),
            pr_start: pickString(row, ['plod']),
            pr_end: pickString(row, ['plof']),
            lieudit: pickString(row, ['lieudit']),
            commune: pickString(row, ['commune']),
            count_type: pickString(row, ['type_compt']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch road traffic');
      }
    }
  );

  server.tool(
    'reunion_get_road_classification',
    'Get the functional classification of Réunion national road segments (category, class, length).',
    {
      route: z.string().optional().describe('Route code filter'),
      classe: z.string().optional().describe('Class filter'),
      limit: z.number().int().min(1).max(500).default(50),
    },
    async ({ route, classe, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_ROAD_CLASS, {
          where: buildWhere([
            route ? `route = ${quote(route)}` : undefined,
            classe ? `classe = ${quote(classe)}` : undefined,
          ]),
          limit,
        });

        return jsonResult({
          total_segments: data.total_count,
          segments: data.results.map((row) => ({
            route: pickString(row, ['route']),
            category: pickString(row, ['categorie']),
            class: pickString(row, ['classe']),
            description: pickString(row, ['descript']),
            length_m: pickNumber(row, ['longueur']),
            pr_start: pickString(row, ['plod']),
            pr_end: pickString(row, ['plof']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch road classification');
      }
    }
  );

  server.tool(
    'reunion_get_cycle_network',
    'Get the Réunion regional cycle network (Voie Vélo Régionale) segments.',
    {
      type: z.string().optional().describe('Amenity type filter'),
      commune: z.string().optional().describe('Micro-region filter (prefix match)'),
      limit: z.number().int().min(1).max(500).default(50),
    },
    async ({ type, commune, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_CYCLE, {
          where: buildWhere([
            type ? `type_amen LIKE ${quote(`${type}%`)}` : undefined,
            commune ? `micro_reg LIKE ${quote(`${commune}%`)}` : undefined,
          ]),
          limit,
        });

        return jsonResult({
          total_segments: data.total_count,
          segments: data.results.map((row) => ({
            type: pickString(row, ['type_amen']),
            identifier: pickString(row, ['identifian']),
            operator: pickString(row, ['exploitant']),
            status: pickString(row, ['etat_amen']),
            commissioning_year: pickNumber(row, ['annee_mis']),
            length_m: pickNumber(row, ['longueur']),
            micro_region: pickString(row, ['micro_reg']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch cycle network');
      }
    }
  );
}
