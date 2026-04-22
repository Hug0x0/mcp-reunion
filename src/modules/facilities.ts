// src/modules/facilities.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, pickNumber, pickString, quote } from '../utils/helpers.js';

const DATASET_BPE = 'base-permanente-des-equipements-geolocalisee-la-reunion';
const DATASET_SPORT = 'equipements-sportifs';
const DATASET_POOLS = 'data-bassin-de-natation';

export function registerFacilityTools(server: McpServer): void {
  server.tool(
    'reunion_search_public_facilities',
    'Search INSEE Base Permanente des Équipements (BPE) entries in Réunion: schools, shops, services, transport, sports, health, tourism.',
    {
      category: z.string().optional().describe('Category filter, e.g. "Services aux particuliers", "Santé"'),
      commune: z.string().optional().describe('Commune filter (prefix match)'),
      equipment_name: z.string().optional().describe('Equipment label search (substring)'),
      limit: z.number().int().min(1).max(500).default(50),
    },
    async ({ category, commune, equipment_name, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_BPE, {
          where: buildWhere([
            category ? `category LIKE ${quote(`${category}%`)}` : undefined,
            commune ? `com_arm_name LIKE ${quote(`${commune}%`)}` : undefined,
            equipment_name ? `search(${quote(equipment_name)})` : undefined,
          ]),
          limit,
        });

        return jsonResult({
          total_equipments: data.total_count,
          equipments: data.results.map((row) => ({
            name: pickString(row, ['equipment_name']),
            code: pickString(row, ['equipment_code']),
            category: pickString(row, ['category']),
            commune: pickString(row, ['com_arm_name']),
            epci: pickString(row, ['epci_name']),
            year: pickString(row, ['year']),
            geo_quality: pickString(row, ['geocode_quality']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search facilities');
      }
    }
  );

  server.tool(
    'reunion_list_swimming_pools',
    'List swimming-pool installations in Réunion with commune, equipment type and accessibility information.',
    {
      commune: z.string().optional().describe('Commune filter (prefix match)'),
      type: z.string().optional().describe('Equipment type filter (prefix match), e.g. "Bassin"'),
      limit: z.number().int().min(1).max(300).default(50),
    },
    async ({ commune, type, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_POOLS, {
          where: buildWhere([
            commune ? `commune LIKE ${quote(`${commune}%`)}` : undefined,
            type ? `type_d_equipement_sportif LIKE ${quote(`${type}%`)}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_pools: data.total_count,
          pools: data.results.map((row) => ({
            installation: pickString(row, ['nom_de_l_installation_sportive']),
            equipment: pickString(row, ['nom_de_l_equipement_sportif']),
            type: pickString(row, ['type_d_equipement_sportif']),
            family: pickString(row, ['famille_d_equipement_sportif']),
            address: pickString(row, ['numero_type_et_nom_de_la_voie']),
            postal_code: pickString(row, ['code_postal']),
            commune: pickString(row, ['commune']),
            accessible_reduced_mobility: pickString(row, ['accessibilite_de_l_installation_en_faveur_des_personnes_en_situation_de_handicap']),
            public_transport_accessible: pickString(row, ['accessibilite_de_l_installation_en_transport_en_commun']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to list swimming pools');
      }
    }
  );

  server.tool(
    'reunion_search_sport_facilities',
    'Search sport facilities in Réunion (gymnases, stades, piscines, courts, terrains de boules, etc.).',
    {
      type: z.string().optional().describe('Equipment type, e.g. "Tennis", "Football"'),
      family: z.string().optional().describe('Equipment family filter'),
      commune: z.string().optional().describe('Commune filter (prefix match)'),
      limit: z.number().int().min(1).max(500).default(50),
    },
    async ({ type, family, commune, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_SPORT, {
          where: buildWhere([
            type ? `type_d_equipement_sportif LIKE ${quote(`${type}%`)}` : undefined,
            family ? `famille_d_equipement_sportif LIKE ${quote(`${family}%`)}` : undefined,
            commune ? `commune LIKE ${quote(`${commune}%`)}` : undefined,
          ]),
          limit,
        });

        return jsonResult({
          total_facilities: data.total_count,
          facilities: data.results.map((row) => ({
            installation_name: pickString(row, ['nom_de_l_installation_sportive']),
            equipment_name: pickString(row, ['nom_de_l_equipement_sportif']),
            type: pickString(row, ['type_d_equipement_sportif']),
            family: pickString(row, ['famille_d_equipement_sportif']),
            address: pickString(row, ['numero_type_et_nom_de_la_voie']),
            postal_code: pickString(row, ['code_postal']),
            commune: pickString(row, ['commune']),
            accessible: pickString(row, ['accessibilite_de_l_installation_en_faveur_des_personnes_en_situation_de_handicap']),
            parking_spaces: pickNumber(row, ['nombre_de_places_de_parking_reservees_a_l_installation']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search sport facilities');
      }
    }
  );
}
