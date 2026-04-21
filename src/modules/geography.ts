// src/modules/geography.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { PublicFacility, RecordObject } from '../types.js';
import {
  buildWhere,
  errorResult,
  jsonResult,
  pickNumber,
  pickString,
  quote,
} from '../utils/helpers.js';

const DATASET_FACILITIES = 'atlas-equipements-publics-serail';
const DATASET_VEHICLES = 'vehicules-immatricules-nc';

const facilityTypeMap: Record<string, string> = {
  Enseignement: 'ENSEIGNEMENT',
  Sport: 'SPORT',
  Administration: 'ADMINISTRATION',
  'Justice et Sécurité': 'JUSTICE',
  'Culture et Socio-éducatif': 'CULTURE',
  'Sanitaire et Social': 'SANITAIRE',
  'Transport et Déchet': 'TRANSPORT',
  Culte: 'CULTE',
  'Parcs et loisirs': 'PARCS',
};

function extractCoordinates(record: PublicFacility): { latitude?: number; longitude?: number } {
  return {
    latitude: record.geo_point_2d?.lat ?? record.latitude,
    longitude: record.geo_point_2d?.lon ?? record.longitude,
  };
}

export function registerGeographyTools(server: McpServer): void {
  /**
   * Get public facilities
   */
  server.tool(
    'nc_get_public_facilities',
    'Get public facilities (schools, sports, health, transport) in Greater Nouméa',
    {
      type: z
        .enum([
          'Enseignement',
          'Sport',
          'Administration',
          'Justice et Sécurité',
          'Culture et Socio-éducatif',
          'Sanitaire et Social',
          'Transport et Déchet',
          'Culte',
          'Parcs et loisirs',
        ])
        .optional()
        .describe('Type of facility'),
      commune: z.string().optional().describe('Filter by commune'),
      limit: z.number().int().min(1).max(100).default(50).describe('Max results'),
    },
    async ({ type, commune, limit }) => {
      try {
        const [communeField, categoryField] = await Promise.all([
          client.resolveField(DATASET_FACILITIES, ['apparten', 'commune']),
          client.resolveField(DATASET_FACILITIES, ['theme1', 'famille']),
        ]);

        const data = await client.getRecords<PublicFacility>(DATASET_FACILITIES, {
          where: buildWhere([
            type && categoryField
              ? `${categoryField} LIKE ${quote(`${facilityTypeMap[type]}%`)}`
              : undefined,
            commune && communeField
              ? `${communeField} LIKE ${quote(`${commune.toUpperCase()}%`)}`
              : undefined,
          ]),
          limit,
        });

        return jsonResult({
          total_facilities: data.total_count,
          facilities: data.results.map((facility) => ({
            name: pickString(facility, ['lib_norme', 'nom']),
            type: pickString(facility, ['lib_court', 'type']),
            category: pickString(facility, [categoryField ?? 'theme1', 'theme1', 'famille']),
            commune: pickString(facility, [communeField ?? 'apparten', 'apparten', 'commune']),
            address: pickString(facility, ['libadrs', 'adresse']),
            coordinates: extractCoordinates(facility),
          })),
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to fetch facilities'
        );
      }
    }
  );

  /**
   * Search facilities by name
   */
  server.tool(
    'nc_search_facilities',
    'Search public facilities by name in Greater Nouméa',
    {
      query: z.string().min(2).describe('Search term'),
      limit: z.number().int().min(1).max(50).default(20).describe('Max results'),
    },
    async ({ query, limit }) => {
      try {
        const data = await client.getRecords<PublicFacility>(DATASET_FACILITIES, {
          where: `search(${quote(query)})`,
          limit,
        });

        return jsonResult({
          query,
          total_found: data.total_count,
          facilities: data.results.map((facility) => ({
            name: pickString(facility, ['lib_norme', 'nom']),
            type: pickString(facility, ['lib_court', 'type']),
            category: pickString(facility, ['theme1', 'famille']),
            commune: pickString(facility, ['apparten', 'commune']),
            coordinates: extractCoordinates(facility),
          })),
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to search facilities'
        );
      }
    }
  );

  /**
   * Get vehicle registration statistics
   */
  server.tool(
    'nc_get_vehicle_stats',
    'Get statistics about registered vehicles in Réunion',
    {
      vehicle_type: z.string().optional().describe('Filter by vehicle type'),
      year: z.number().int().min(1990).max(2030).optional().describe('Registration year'),
      group_by: z
        .enum(['type', 'marque', 'annee', 'commune'])
        .default('type')
        .describe('How to group results'),
    },
    async ({ vehicle_type, year, group_by }) => {
      try {
        const dateField =
          (await client.resolveField(DATASET_VEHICLES, [
            'date_1ere_mise_en_circulation',
            'date_emission',
          ])) ?? 'date_1ere_mise_en_circulation';

        const groupFieldMap: Record<string, string | undefined> = {
          type: await client.resolveField(DATASET_VEHICLES, ['genre', 'type_nc']),
          marque: await client.resolveField(DATASET_VEHICLES, ['marque']),
          annee: dateField,
          commune: await client.resolveField(DATASET_VEHICLES, [
            'commune_proprietaire',
            'commune',
          ]),
        };

        const typeField =
          (await client.resolveField(DATASET_VEHICLES, ['genre', 'type_nc'])) ?? 'genre';
        const groupField = groupFieldMap[group_by];

        if (!groupField) {
          return jsonResult({
            grouped_by: group_by,
            message: 'Requested grouping is not available on the current dataset schema.',
            statistics: [],
          });
        }

        const where = buildWhere([
          vehicle_type ? `${typeField} LIKE ${quote(`${vehicle_type}%`)}` : undefined,
          year !== undefined
            ? `${dateField} >= '${year}-01-01' AND ${dateField} < '${year + 1}-01-01'`
            : undefined,
        ]);

        const data = await client.getAggregates<RecordObject>(
          DATASET_VEHICLES,
          `count(*) as count, ${groupField}`,
          {
            where,
            groupBy: groupField,
          }
        );

        return jsonResult({
          grouped_by: group_by,
          source_field: groupField,
          note:
            group_by === 'annee'
              ? 'The public dataset exposes full dates. Grouping by "annee" therefore uses the source date field as published.'
              : undefined,
          statistics: data.results,
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to fetch vehicle stats'
        );
      }
    }
  );
}
