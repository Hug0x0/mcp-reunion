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
    'Search the INSEE Base Permanente des Équipements (BPE) for La Réunion. BPE is the reference inventory of facilities providing services to the public: shops (commerces), education, health, social services, transport, sports, tourism, public administration. Each row is one geocoded equipment with INSEE category code. Returns equipment name and code, category, commune, EPCI, year, geocoding quality. Use this for accessibility/coverage analysis, market studies, urban planning.',
    {
      category: z.string().optional().describe('Equipment category prefix match. Examples: "Services aux particuliers", "Commerce", "Enseignement", "Santé", "Sports, loisirs et culture", "Transports et tourisme"'),
      commune: z.string().optional().describe('Commune name prefix match'),
      equipment_name: z.string().optional().describe('Free-text search on the equipment name'),
      limit: z.number().int().min(1).max(500).default(50).describe('Max equipments to return (1-500, default 50)'),
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
    'List swimming-pool basins in La Réunion (subset of the national sport-equipment registry RES, filtered to pool-related equipment types). Each row is one basin within an installation. Returns installation name, equipment name, type, family, address, postal code, commune, reduced-mobility accessibility flag, public-transport accessibility flag. Useful for sport-policy analysis, accessibility studies, family activities planning.',
    {
      commune: z.string().optional().describe('Commune name prefix match'),
      type: z.string().optional().describe('Sport-equipment type prefix match. Examples: "Bassin sportif", "Bassin de loisirs", "Bassin mixte"'),
      limit: z.number().int().min(1).max(300).default(50).describe('Max pools to return (1-300, default 50)'),
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
    'Search the national sport-equipment registry (Recensement des Équipements Sportifs, RES) restricted to La Réunion. Covers all sport infrastructure: stadiums, gyms, swimming pools, tennis courts, boules courts, athletic tracks, climbing walls, skate parks, dojos, etc. Each row is one equipment within an installation. Returns installation and equipment names, type, family, address, postal code, commune, reduced-mobility accessibility, parking spaces. Source: Ministère des Sports via data.regionreunion.com.',
    {
      type: z.string().optional().describe('Sport-equipment type prefix match. Examples: "Court de tennis", "Terrain de football", "Salle multisports", "Piste d\'athlétisme", "Mur d\'escalade"'),
      family: z.string().optional().describe('Equipment family prefix match. Examples: "Petits terrains en accès libre", "Terrains de grands jeux", "Salles spécialisées", "Bassins de natation"'),
      commune: z.string().optional().describe('Commune name prefix match'),
      limit: z.number().int().min(1).max(500).default(50).describe('Max facilities to return (1-500, default 50)'),
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
