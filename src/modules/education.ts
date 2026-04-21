// src/modules/education.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, pickNumber, pickString, quote } from '../utils/helpers.js';

const DATASET_IPS_COLLEGES = 'indices-de-position-sociale-dans-les-colleges-a-la-reunion';
const DATASET_G2024 = 'etablissements-labellises-generation-2024-a-la-reunion';
const DATASET_PARCOURSUP = 'cartographie-des-formations-parcoursup-a-la-reunion';

export function registerEducationTools(server: McpServer): void {
  server.tool(
    'reunion_get_college_ips',
    'Get the DEPP social position index (IPS) of Réunion middle schools (collèges).',
    {
      commune: z.string().optional().describe('Commune filter (prefix match)'),
      sector: z.enum(['Public', 'Privé sous contrat']).optional(),
      rentree: z.string().optional().describe('School year, e.g. "2022-2023"'),
      limit: z.number().int().min(1).max(500).default(100),
    },
    async ({ commune, sector, rentree, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_IPS_COLLEGES, {
          where: buildWhere([
            commune ? `nom_de_la_commune LIKE ${quote(`${commune}%`)}` : undefined,
            sector ? `secteur = ${quote(sector)}` : undefined,
            rentree ? `rentree_scolaire = ${quote(rentree)}` : undefined,
          ]),
          order_by: 'ips DESC',
          limit,
        });
        return jsonResult({
          total_schools: data.total_count,
          schools: data.results.map((row) => ({
            school: pickString(row, ['nom_de_l_etablissment']),
            uai: pickString(row, ['uai']),
            commune: pickString(row, ['nom_de_la_commune']),
            sector: pickString(row, ['secteur']),
            rentree: pickString(row, ['rentree_scolaire']),
            ips: pickNumber(row, ['ips']),
            ips_stddev: pickNumber(row, ['ecart_type_de_l_ips']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch college IPS');
      }
    }
  );

  server.tool(
    'reunion_list_gen2024_schools',
    'List Réunion schools labelled "Génération 2024" (sport-oriented label tied to the Paris Olympics).',
    {
      commune: z.string().optional(),
      type: z.string().optional().describe('Establishment type: école, collège, lycée, …'),
      limit: z.number().int().min(1).max(300).default(100),
    },
    async ({ commune, type, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_G2024, {
          where: buildWhere([
            commune ? `commune LIKE ${quote(`${commune}%`)}` : undefined,
            type ? `type LIKE ${quote(`${type}%`)}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_schools: data.total_count,
          schools: data.results.map((row) => ({
            name: pickString(row, ['nom_etablissement']),
            uai: pickString(row, ['uai']),
            type: pickString(row, ['type']),
            sector: pickString(row, ['statut_public_prive']),
            commune: pickString(row, ['commune']),
            enrollment: pickNumber(row, ['effectif']),
            priority_zone: pickString(row, ['educ_prio']),
            has_ulis: pickNumber(row, ['ulis']) === 1,
            has_segpa: pickNumber(row, ['segpa']) === 1,
            has_sport_section: pickNumber(row, ['section_sport']) === 1,
            is_lycee_des_metiers: pickNumber(row, ['lycee_des_metiers']) === 1,
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch G2024 schools');
      }
    }
  );

  server.tool(
    'reunion_search_parcoursup_formations',
    'Search post-baccalaureate training programs available via Parcoursup in Réunion.',
    {
      year: z.string().optional().describe('Session year, e.g. "2025"'),
      query: z.string().optional().describe('Free-text search on formation name/specialty'),
      commune: z.string().optional().describe('Commune filter (prefix match)'),
      limit: z.number().int().min(1).max(500).default(50),
    },
    async ({ year, query, commune, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_PARCOURSUP, {
          where: buildWhere([
            year ? `annee = ${quote(year)}` : undefined,
            query ? `search(${quote(query)})` : undefined,
            commune ? `commune LIKE ${quote(`${commune}%`)}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_formations: data.total_count,
          formations: data.results.map((row) => ({
            session: pickString(row, ['annee']),
            school: pickString(row, ['etab_nom']),
            uai: pickString(row, ['etab_uai']),
            sector: pickString(row, ['tc']),
            formation_types: pickString(row, ['tf']),
            long_name: pickString(row, ['nm']),
            mention_specialty: pickString(row, ['fl']),
            apprenticeship: pickString(row, ['app']),
            commune: pickString(row, ['commune']),
            fiche_url: pickString(row, ['fiche']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search Parcoursup formations');
      }
    }
  );
}
