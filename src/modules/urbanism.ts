// src/modules/urbanism.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, pickNumber, pickString, quote } from '../utils/helpers.js';

const DATASET_PLU = 'base-permanente-des-plu-de-la-reunion';
const DATASET_PERMITS_NR = 'liste-des-permis-de-constuire-creant-des-locaux-non-residentiels-a-la-reunion';

export function registerUrbanismTools(server: McpServer): void {
  server.tool(
    'reunion_search_plu_zones',
    'Search the permanent PLU (Plan Local d\'Urbanisme) zoning database for La Réunion. Each row is one zone within a commune\'s PLU/PLUi, defining what can be built where. Returns commune INSEE, zone code (e.g. "Ua", "1AU", "Ah"), full label, zone type (U/AU/A/N), dominant destination, PLU document ID, document name and URL, approval date, end of validity. Source: GPU (Géoportail de l\'Urbanisme) via data.regionreunion.com. Essential for real-estate due diligence, project siting, urbanism research.',
    {
      insee: z.string().optional().describe('Commune INSEE code (5 digits, Réunion communes are "974xx"). Examples: "97411" Saint-Denis, "97410" Saint-Pierre, "97417" Saint-Paul'),
      zone_type: z.string().optional().describe('Zone typology code (single letter or short code): "U" (zone urbaine, currently built up), "AU" (à urbaniser), "A" (agricole), "N" (naturelle)'),
      limit: z.number().int().min(1).max(500).default(100).describe('Max zones to return (1-500, default 100)'),
    },
    async ({ insee, zone_type, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_PLU, {
          where: buildWhere([
            insee ? `insee = ${quote(insee)}` : undefined,
            zone_type ? `typezone = ${quote(zone_type)}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_zones: data.total_count,
          zones: data.results.map((row) => ({
            commune_insee: pickString(row, ['insee']),
            zone_code: pickString(row, ['libelle']),
            zone_label: pickString(row, ['libelong']),
            zone_type: pickString(row, ['typezone']),
            dominant_destination: pickString(row, ['destdomi']),
            plu_id: pickString(row, ['idurba']),
            document_name: pickString(row, ['nomfic']),
            document_url: pickString(row, ['urlfic']),
            approval_date: pickString(row, ['datappro']),
            end_of_validity: pickString(row, ['datefinval']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search PLU zones');
      }
    }
  );

  server.tool(
    'reunion_search_building_permits',
    'Search non-residential building authorizations from the Sitadel database (Système d\'information et de traitement automatisé des données élémentaires sur les logements et les locaux), restricted to La Réunion. Covers permis de construire (PC), déclarations préalables (DP), and permis d\'aménager (PA) for non-residential premises (commerce, offices, industry, agriculture, equipment). Returns commune INSEE, type, reference, filing year, authorization date, works start (DOC) and completion (DAACT) dates, project nature code, primary destination, applicant identity, site address, terrain surface. Sorted by authorization date descending.',
    {
      commune: z.string().optional().describe('Commune INSEE code, exact match (e.g. "97411" for Saint-Denis)'),
      year: z.number().int().optional().describe('Filing year (4 digits)'),
      type: z.enum(['PC', 'DP', 'PA']).optional().describe('Authorization type: "PC" = Permis de Construire (full construction permit), "DP" = Déclaration Préalable (light works), "PA" = Permis d\'Aménager (land development)'),
      limit: z.number().int().min(1).max(500).default(100).describe('Max permits to return (1-500, default 100)'),
    },
    async ({ commune, year, type, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_PERMITS_NR, {
          where: buildWhere([
            commune ? `comm = ${quote(commune)}` : undefined,
            year !== undefined ? `an_depot = ${year}` : undefined,
            type ? `type_dau = ${quote(type)}` : undefined,
          ]),
          order_by: 'date_reelle_autorisation DESC',
          limit,
        });
        return jsonResult({
          total_permits: data.total_count,
          permits: data.results.map((row) => ({
            commune_insee: pickString(row, ['comm']),
            department: pickString(row, ['dep']),
            type: pickString(row, ['type_dau']),
            reference: pickString(row, ['num_dau']),
            filing_year: pickNumber(row, ['an_depot']),
            authorized_on: pickString(row, ['date_reelle_autorisation']),
            works_started_on: pickString(row, ['date_reelle_doc']),
            works_completed_on: pickString(row, ['date_reelle_daact']),
            project_nature_code: pickNumber(row, ['nature_projet_declaree']),
            primary_destination_code: pickNumber(row, ['destination_principale']),
            applicant_name: pickString(row, ['denom_dem']),
            applicant_city: pickString(row, ['localite_dem']),
            site_address_street: pickString(row, ['adr_libvoie_ter']),
            site_postal_code: pickString(row, ['adr_codpost_ter']),
            site_city: pickString(row, ['adr_localite_ter']),
            terrain_surface_m2: pickNumber(row, ['superficie_terrain']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search building permits');
      }
    }
  );
}
