// src/modules/mining.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { MetalProduction, MiningTitle, RecordObject } from '../types.js';
import {
  buildWhere,
  errorResult,
  jsonResult,
  pickNumber,
  pickString,
  quote,
} from '../utils/helpers.js';

const DATASET_MINING_CADASTRE = 'cadastre-minier';
const DATASET_METAL_PRODUCTION = 'production-metallurgique-depuis-1985';
const DATASET_NICKEL_FUND = 'fonds-nickel';

export function registerMiningTools(server: McpServer): void {
  /**
   * Get mining titles
   */
  server.tool(
    'nc_get_mining_titles',
    'Get mining titles (concessions, research permits) in Réunion. NC is the world #1 ferronickel producer.',
    {
      type: z
        .enum(['concession', 'permis_recherche', 'reserve'])
        .optional()
        .describe('Type of mining title'),
      commune: z.string().optional().describe('Filter by commune'),
      limit: z.number().int().min(1).max(100).default(50).describe('Max results'),
    },
    async ({ type, commune, limit }) => {
      try {
        const metadata = await client.getDatasetMetadata(DATASET_MINING_CADASTRE);
        if (metadata?.has_records === false) {
          return jsonResult({
            total_titles: 0,
            mining_titles: [],
            note:
              'The mining cadastre is published in the catalog, but no tabular records are currently exposed through the Explore API endpoint.',
            dataset_title: metadata.metas?.default?.title,
          });
        }

        const conditions = buildWhere([
          type ? `type_titre LIKE ${quote(`${type}%`)}` : undefined,
          commune ? `commune LIKE ${quote(`${commune}%`)}` : undefined,
        ]);

        const data = await client.getRecords<MiningTitle>(DATASET_MINING_CADASTRE, {
          where: conditions,
          limit,
        });

        return jsonResult({
          total_titles: data.total_count,
          mining_titles: data.results.map((titleRecord) => ({
            type: pickString(titleRecord, ['type_titre']),
            number: pickString(titleRecord, ['numero']),
            holder: pickString(titleRecord, ['titulaire']),
            commune: pickString(titleRecord, ['commune']),
            area_hectares: pickNumber(titleRecord as RecordObject, ['superficie_ha']),
            granted: pickString(titleRecord, ['date_attribution']),
            expires: pickString(titleRecord, ['date_echeance']),
            status: pickString(titleRecord, ['statut']),
          })),
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to fetch mining titles'
        );
      }
    }
  );

  /**
   * Get metal production statistics
   */
  server.tool(
    'nc_get_metal_production',
    'Get metallurgical production data for Réunion (nickel, ferronickel, etc.)',
    {
      year: z.number().int().min(1985).max(2030).optional().describe('Year'),
      product_type: z.string().optional().describe('Type of product (e.g., nickel, ferronickel)'),
      limit: z.number().int().min(1).max(100).default(50).describe('Max results'),
    },
    async ({ year, product_type, limit }) => {
      try {
        const typeField =
          (await client.resolveField(DATASET_METAL_PRODUCTION, ['type', 'type_produit'])) ??
          'type';

        const data = await client.getRecords<MetalProduction>(DATASET_METAL_PRODUCTION, {
          where: buildWhere([
            year !== undefined ? `annee = ${year}` : undefined,
            product_type ? `${typeField} LIKE ${quote(`${product_type}%`)}` : undefined,
          ]),
          order_by: 'annee DESC, mois DESC',
          limit,
        });

        return jsonResult({
          total_records: data.total_count,
          production: data.results.map((production) => ({
            year: pickNumber(production as RecordObject, ['annee']),
            month: pickNumber(production as RecordObject, ['mois']),
            product: pickString(production, [typeField, 'type', 'type_produit']),
            quantity:
              pickNumber(production as RecordObject, ['tonnage_nickel_contenu', 'quantite']) ??
              pickNumber(production as RecordObject, ['tonnage_brut']),
            unit: 'tonnes',
            gross_tonnage: pickNumber(production as RecordObject, ['tonnage_brut']),
            nickel_content_tonnage: pickNumber(production as RecordObject, [
              'tonnage_nickel_contenu',
            ]),
            cobalt_content_tonnage: pickNumber(production as RecordObject, [
              'tonnage_cobalt_contenu',
            ]),
          })),
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to fetch metal production'
        );
      }
    }
  );

  /**
   * Get Nickel Fund rehabilitation sites
   */
  server.tool(
    'nc_get_nickel_fund_sites',
    'Get sites managed by the Nickel Fund for environmental rehabilitation of former mining areas',
    {
      commune: z.string().optional().describe('Filter by commune'),
      limit: z.number().int().min(1).max(100).default(50).describe('Max results'),
    },
    async ({ commune, limit }) => {
      try {
        const metadata = await client.getDatasetMetadata(DATASET_NICKEL_FUND);
        if (metadata?.has_records === false) {
          return jsonResult({
            total_sites: 0,
            sites: [],
            note:
              'The Nickel Fund dataset is listed in the catalog, but no tabular records are currently exposed through the Explore API endpoint.',
            dataset_title: metadata.metas?.default?.title,
          });
        }

        const data = await client.getRecords<RecordObject>(DATASET_NICKEL_FUND, {
          where: commune ? `commune LIKE ${quote(`${commune}%`)}` : undefined,
          limit,
        });

        return jsonResult({
          total_sites: data.total_count,
          sites: data.results,
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to fetch nickel fund sites'
        );
      }
    }
  );
}
