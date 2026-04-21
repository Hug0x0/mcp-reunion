// src/modules/health.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, pickString, quote } from '../utils/helpers.js';

const DATASET_HEALTH_PROS = 'annuaire-des-professionnels-de-santepublic';

export function registerHealthTools(server: McpServer): void {
  server.tool(
    'reunion_search_health_professionals',
    'Search the CNAM health-professional directory, filtered to Réunion.',
    {
      profession: z.string().optional().describe('Profession name (prefix match), e.g. "Médecin", "Dentiste", "Infirmier"'),
      commune: z.string().optional().describe('Commune filter (substring on address)'),
      postal_code: z.string().optional().describe('Postal code filter'),
      limit: z.number().int().min(1).max(200).default(50),
    },
    async ({ profession, commune, postal_code, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_HEALTH_PROS, {
          where: buildWhere([
            `reg_name = ${quote('La Réunion')}`,
            profession ? `libelle_profession LIKE ${quote(`${profession}%`)}` : undefined,
            commune ? `search(${quote(commune)})` : undefined,
            postal_code ? `code_postal = ${quote(postal_code)}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_professionals: data.total_count,
          professionals: data.results.map((row) => ({
            name: pickString(row, ['nom']),
            title: pickString(row, ['civilite']),
            profession: pickString(row, ['libelle_profession']),
            address: [pickString(row, ['adresse3']), pickString(row, ['adresse4'])]
              .filter(Boolean)
              .join(' '),
            postal_code: pickString(row, ['code_postal']),
            phone: pickString(row, ['telephone']),
            practice: pickString(row, ['exercice_particulier']),
            nature: pickString(row, ['nature_exercice']),
            convention: pickString(row, ['convention']),
            sesam_vitale: pickString(row, ['sesam_vitale']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search health professionals');
      }
    }
  );
}
