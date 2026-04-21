// src/modules/tourism.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, pickNumber, pickString, quote } from '../utils/helpers.js';

const DATASET_FAMILY_TRAILS = 'sentiers-marmailles-lareunion';
const DATASET_CANYONS = 'bdcanyons-lareunion';
const DATASET_LANDMARKS = 'lieux-remarquables-lareunion-wssoubik';

export function registerTourismTools(server: McpServer): void {
  server.tool(
    'reunion_list_family_trails',
    'List family-friendly ("sentiers marmailles") walking trails across Réunion.',
    {
      limit: z.number().int().min(1).max(200).default(50),
    },
    async ({ limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_FAMILY_TRAILS, { limit });
        return jsonResult({
          total_trails: data.total_count,
          trails: data.results.map((row) => ({
            name: pickString(row, ['nom_itiner']),
            length_km: pickNumber(row, ['longueur_k']),
            duration: pickString(row, ['duree_h_mi']),
            id: pickNumber(row, ['id_sentier']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch family trails');
      }
    }
  );

  server.tool(
    'reunion_list_canyons',
    'List practiced canyoning routes in Réunion with duration, frequentation, and access notes.',
    {
      secteur: z.string().optional().describe('Geographic sector filter (prefix match)'),
      limit: z.number().int().min(1).max(300).default(50),
    },
    async ({ secteur, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_CANYONS, {
          where: buildWhere([secteur ? `secteur LIKE ${quote(`${secteur}%`)}` : undefined]),
          limit,
        });
        return jsonResult({
          total_canyons: data.total_count,
          canyons: data.results.map((row) => ({
            name: pickString(row, ['nom']),
            alt_name: pickString(row, ['nom_2']),
            ravine: pickString(row, ['ravine']),
            sector: pickString(row, ['secteur']),
            typology_approach: pickString(row, ['typologiea']),
            typology_return: pickString(row, ['typologier']),
            frequentation: pickNumber(row, ['frequentat']),
            total_duration_hours: pickNumber(row, ['dureetotal']),
            descent_minutes: pickNumber(row, ['tps_parcou']),
            approach_minutes: pickNumber(row, ['tps_approc']),
            return_minutes: pickNumber(row, ['tps_retour']),
            forbidden: pickString(row, ['interdit']),
            length_m: pickNumber(row, ['long_sig']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch canyons');
      }
    }
  );

  server.tool(
    'reunion_list_landmarks',
    'List remarkable tourism landmarks in Réunion (from the SIT Soubik catalog).',
    {
      commune: z.string().optional().describe('Commune filter (prefix match)'),
      major_only: z.boolean().default(false).describe('Only return landmarks flagged as "lieu majeur"'),
      limit: z.number().int().min(1).max(200).default(50),
    },
    async ({ commune, major_only, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_LANDMARKS, {
          where: buildWhere([
            commune ? `commune LIKE ${quote(`${commune}%`)}` : undefined,
            major_only ? 'lieu_majeur = 1' : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_landmarks: data.total_count,
          landmarks: data.results.map((row) => ({
            name: pickString(row, ['nom_du_lieu_remarquable']),
            tagline: pickString(row, ['accroche']),
            commune: pickString(row, ['commune']),
            major: pickNumber(row, ['lieu_majeur']) === 1,
            in_national_park: pickNumber(row, ['situe_dans_un_parc_national']) === 1,
            unesco_world_heritage: pickNumber(row, ['appartient_au_patrimoine_mondial']) === 1,
            characteristics: pickString(row, ['caracteristiques']),
            reduced_mobility_accessible: pickString(row, ['accessible_mobilite_reduite']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch landmarks');
      }
    }
  );
}
