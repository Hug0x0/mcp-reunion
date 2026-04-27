// src/modules/possession.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, pickNumber, pickString, quote } from '../utils/helpers.js';

const DATASET_PROCUREMENT = 'donnees-essentielles-marches-publics-mairie-de-la-possession';
const DATASET_GRANTS_2022 = 'subventions-attribuees-aux-associations-en-2022';
const DATASET_GRANTS_2023 = 'subventions-attribuees-aux-associations-en-2023';

const GRANT_DATASETS: Record<string, string> = {
  '2022': DATASET_GRANTS_2022,
  '2023': DATASET_GRANTS_2023,
};

export function registerPossessionTools(server: McpServer): void {
  server.tool(
    'reunion_possession_search_procurement',
    'Search public-procurement contracts awarded by the Commune of La Possession (west Réunion), published in the Socle Commun des Données Locales (SCDL) format. Each row is one signed contract. Returns ID, nature (Marché / Accord-cadre / etc.), object/purpose, CPV code (Common Procurement Vocabulary), procedure type, place of execution, duration (months), notification date, publication date, amount (EUR), price form, holder identities, supplier city. Sorted by notification date descending. For BOAMP-published notices (broader than just Possession), use reunion_search_boamp.',
    {
      query: z.string().optional().describe('Free-text search on contract object/purpose'),
      nature: z.string().optional().describe('Exact contract nature. Examples: "Marché", "Accord-cadre", "Marché subséquent"'),
      procedure: z.string().optional().describe('Exact procedure type. Examples: "Procédure adaptée", "Appel d\'offres ouvert", "Marché négocié"'),
      min_amount: z.number().optional().describe('Minimum contract amount in EUR (inclusive)'),
      limit: z.number().int().min(1).max(300).default(50).describe('Max contracts to return (1-300, default 50)'),
    },
    async ({ query, nature, procedure, min_amount, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_PROCUREMENT, {
          where: buildWhere([
            query ? `search(${quote(query)})` : undefined,
            nature ? `nature = ${quote(nature)}` : undefined,
            procedure ? `procedure = ${quote(procedure)}` : undefined,
            min_amount !== undefined ? `montant >= ${min_amount}` : undefined,
          ]),
          order_by: 'datenotification DESC',
          limit,
        });
        return jsonResult({
          total_contracts: data.total_count,
          contracts: data.results.map((row) => ({
            id: pickString(row, ['id']),
            nature: pickString(row, ['nature']),
            object: pickString(row, ['objet']),
            cpv_code: pickString(row, ['codecpv']),
            procedure: pickString(row, ['procedure']),
            place_of_execution: pickString(row, ['lieuexecution']),
            duration_months: pickNumber(row, ['dureemois']),
            notified_on: pickString(row, ['datenotification']),
            published_on: pickString(row, ['datepublicationdonnees']),
            amount_eur: pickNumber(row, ['montant']),
            price_form: pickString(row, ['formeprix']),
            holders: pickString(row, ['titulaires']),
            supplier_city: pickString(row, ['communeetablissement']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search procurement contracts');
      }
    }
  );

  server.tool(
    'reunion_possession_search_association_grants',
    'Search subventions (grants) awarded to associations by the Commune of La Possession in 2022 or 2023 (separate annual datasets). Returns issuing authority, beneficiary association name, convention date, grant object/purpose, amount (EUR), nature, payment conditions, grant share %. Sorted by convention date descending. Useful for transparency analysis, association funding research, public-spending audit.',
    {
      year: z.enum(['2022', '2023']).describe('Grant year dataset: "2022" or "2023" (each year has its own dataset)'),
      beneficiary: z.string().optional().describe('Beneficiary association name substring search'),
      min_amount: z.number().optional().describe('Minimum grant amount in EUR (inclusive)'),
      limit: z.number().int().min(1).max(500).default(50).describe('Max grants to return (1-500, default 50)'),
    },
    async ({ year, beneficiary, min_amount, limit }) => {
      try {
        const datasetId = GRANT_DATASETS[year];
        const amountExpr = year === '2022' ? `CAST(montant as double) >= ${min_amount}` : `montant >= ${min_amount}`;
        const data = await client.getRecords<RecordObject>(datasetId, {
          where: buildWhere([
            beneficiary ? `search(${quote(beneficiary)})` : undefined,
            min_amount !== undefined ? amountExpr : undefined,
          ]),
          order_by: 'dateconvention DESC',
          limit,
        });
        return jsonResult({
          year,
          total_grants: data.total_count,
          grants: data.results.map((row) => ({
            issuer: pickString(row, ['nomattribuant']),
            beneficiary: pickString(row, ['nombeneficiaire']),
            convention_date: pickString(row, ['dateconvention']),
            object: pickString(row, ['objet']),
            amount_eur: pickNumber(row, ['montant']),
            nature: pickString(row, ['nature']),
            payment_conditions: pickString(row, ['conditionsversement']),
            grant_share_pct: pickNumber(row, ['pourcentagesubvention']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search association grants');
      }
    }
  );
}
