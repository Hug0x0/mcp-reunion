// src/modules/hospitality.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, pickNumber, pickString, quote } from '../utils/helpers.js';

const DATASET_ESTABLISHMENTS = 'etablissements-touristiques-lareunion-wssoubik';
const DATASET_CLASSIFIED = 'hebergements-classespublic';
const DATASET_ECOLODGE = 'localisation-potentielle-ecolodge-lareunion';

export function registerHospitalityTools(server: McpServer): void {
  server.tool(
    'reunion_search_tourism_establishments',
    'Search the SIT Soubik (Système d\'Information Touristique) catalog for La Réunion: hotels, restaurants, gîtes, activity providers, leisure venues, tour operators, transport providers serving tourists. Returns commercial name, type, classification, commune, tourism zone (Nord/Sud/Est/Ouest/Cirques/Volcan), address, accepted payment methods, attached tourist office. For star-classified accommodations specifically, use reunion_search_classified_accommodations.',
    {
      type: z.string().optional().describe('Establishment type prefix match. Examples: "Hôtel", "Restaurant", "Gîte", "Camping", "Activité de loisirs", "Office de tourisme"'),
      commune: z.string().optional().describe('Commune name prefix match'),
      zone: z.string().optional().describe('Tourism zone prefix match. Examples: "Nord", "Sud", "Est", "Ouest", "Cirques", "Volcan"'),
      query: z.string().optional().describe('Free-text search on commercial name and address'),
      limit: z.number().int().min(1).max(300).default(50).describe('Max establishments to return (1-300, default 50)'),
    },
    async ({ type, commune, zone, query, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_ESTABLISHMENTS, {
          where: buildWhere([
            type ? `type LIKE ${quote(`${type}%`)}` : undefined,
            commune ? `commune LIKE ${quote(`${commune}%`)}` : undefined,
            zone ? `zone_touristique LIKE ${quote(`${zone}%`)}` : undefined,
            query ? `search(${quote(query)})` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_establishments: data.total_count,
          establishments: data.results.map((row) => ({
            name: pickString(row, ['nom_commercial']),
            type: pickString(row, ['type']),
            classification: pickString(row, ['classement']),
            commune: pickString(row, ['commune']),
            tourism_zone: pickString(row, ['zone_touristique']),
            address: pickString(row, ['adresse']),
            payment_methods: pickString(row, ['modes_de_paiement']),
            tourist_office: pickString(row, ['offices_de_tourisme']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search tourism establishments');
      }
    }
  );

  server.tool(
    'reunion_search_classified_accommodations',
    'Search collective accommodations in La Réunion that hold an official Atout France star classification (1 to 5 étoiles, valid 5 years). Covers hôtels de tourisme, résidences de tourisme, campings, villages de vacances, parcs résidentiels de loisirs. Returns commercial name, typology, classification (stars), category, classification date and extension flag, stay type, commune, postal code, address, website, room count, capacity in persons. Sorted by classification date descending. Source: Atout France via data.regionreunion.com.',
    {
      typology: z.string().optional().describe('Typology prefix match. Examples: "Hôtel de tourisme", "Camping", "Résidence de tourisme", "Village de vacances", "Parc résidentiel de loisirs"'),
      classification: z.string().optional().describe('Star classification prefix match. Examples: "1 étoile", "2 étoiles", "3 étoiles", "4 étoiles", "5 étoiles"'),
      commune: z.string().optional().describe('Commune name prefix match'),
      limit: z.number().int().min(1).max(300).default(50).describe('Max accommodations to return (1-300, default 50)'),
    },
    async ({ typology, classification, commune, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_CLASSIFIED, {
          where: buildWhere([
            typology ? `typologie_etablissement LIKE ${quote(`${typology}%`)}` : undefined,
            classification ? `classement LIKE ${quote(`${classification}%`)}` : undefined,
            commune ? `commune LIKE ${quote(`${commune}%`)}` : undefined,
          ]),
          order_by: 'date_de_classement DESC',
          limit,
        });
        return jsonResult({
          total_accommodations: data.total_count,
          accommodations: data.results.map((row) => ({
            name: pickString(row, ['nom_commercial']),
            typology: pickString(row, ['typologie_etablissement']),
            classification: pickString(row, ['classement']),
            category: pickString(row, ['categorie']),
            classification_date: pickString(row, ['date_de_classement']),
            classification_extended: pickString(row, ['classement_proroge']),
            stay_type: pickString(row, ['type_de_sejour']),
            commune: pickString(row, ['commune']),
            postal_code: pickString(row, ['code_postal']),
            address: pickString(row, ['adresse']),
            website: pickString(row, ['site_internet']),
            room_count: pickNumber(row, ['nombre_de_chambres']),
            capacity_persons: pickString(row, ['capacite_d_accueil_personnes']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search classified accommodations');
      }
    }
  );

  server.tool(
    'reunion_list_ecolodge_locations',
    'List geocoded locations identified as having potential for ecolodge (eco-friendly tourist accommodation) development in La Réunion. Each row is one candidate site with type and X/Y coordinates (RGR92 / Réunion projection). Useful for sustainable-tourism planning, real-estate scouting in eco-tourism, regional development studies.',
    {},
    async () => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_ECOLODGE, { limit: 50 });
        return jsonResult({
          total_locations: data.total_count,
          locations: data.results.map((row) => ({
            code: pickNumber(row, ['code']),
            type: pickString(row, ['type']),
            x: pickNumber(row, ['x']),
            y: pickNumber(row, ['y']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to list ecolodge locations');
      }
    }
  );
}
