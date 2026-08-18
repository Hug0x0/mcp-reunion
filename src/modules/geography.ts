// src/modules/geography.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, pickNumber, pickString, quote } from '../utils/helpers.js';

const DATASET_BAN = 'ban-lareunion';
const DATASET_BAL_POSSESSION = 'bal-la-possession';
const DATASET_COMMUNES = 'communes-millesime-france';
const DATASET_CANTONS = 'cantons-millesime-france';
const DATASET_EPCI = 'intercommunalites-millesime-france';
const DATASET_IRIS = 'iris-millesime-france';
const DATASET_SAINT_DENIS_QUARTERS = 'les-20-quartiers-villesaintdenis';

export function registerGeographyTools(server: McpServer): void {
  server.tool(
    'reunion_search_ban_addresses',
    'Search the Base Adresse Nationale (BAN) — France\'s authoritative geocoded address database — restricted to La Réunion (~343k addresses). Each address has lat/lon, street name, house number, INSEE commune code, source, last update date, and position type. Use this for geocoding, address validation, last-mile delivery, and mapping. Source: IGN / La Poste / DINUM via data.regionreunion.com.',
    {
      query: z.string().optional().describe('Free-text search across street name and city'),
      commune: z.string().optional().describe('Commune name prefix match (e.g. "Saint-Denis")'),
      insee: z.number().int().optional().describe('INSEE commune code (5 digits as integer, e.g. 97411 for Saint-Denis)'),
      limit: z.number().int().min(1).max(100).default(20).describe('Max addresses to return (1-100, default 20)'),
    },
    async ({ query, commune, insee, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_BAN, {
          where: buildWhere([
            query ? `search(${quote(query)})` : undefined,
            commune ? `commune_nom LIKE ${quote(`${commune}%`)}` : undefined,
            insee !== undefined ? `commune_insee = ${insee}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_addresses: data.total_count,
          addresses: data.results.map((row) => ({
            number: pickNumber(row, ['numero']),
            suffix: pickString(row, ['suffixe']),
            street: pickString(row, ['voie_nom']),
            insee_code: pickNumber(row, ['commune_insee']),
            commune: pickString(row, ['commune_nom']),
            lon: pickNumber(row, ['long']),
            lat: pickNumber(row, ['lat']),
            position_type: pickString(row, ['position']),
            source: pickString(row, ['source']),
            last_update: pickString(row, ['date_der_maj']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search BAN addresses');
      }
    }
  );

  server.tool(
    'reunion_search_bal_possession',
    'Search the Base Adresse Locale (BAL) published directly by the Commune of La Possession (west Réunion). BALs are commune-level address registries that feed BAN. This dataset is more granular than BAN for Possession addresses, including local lieux-dits, cadastral parcels, and last-update timestamps. Returns UID, interop key, street name, lieu-dit complement, suffix, longitude, latitude, cadastral parcels, last update.',
    {
      query: z.string().optional().describe('Free-text search on the address fields'),
      street: z.string().optional().describe('Street name prefix match (e.g. "Rue de", "Chemin")'),
      limit: z.number().int().min(1).max(100).default(20).describe('Max addresses to return (1-100, default 20)'),
    },
    async ({ query, street, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_BAL_POSSESSION, {
          where: buildWhere([
            query ? `search(${quote(query)})` : undefined,
            street ? `voie_nom LIKE ${quote(`${street}%`)}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_addresses: data.total_count,
          addresses: data.results.map((row) => ({
            uid: pickString(row, ['uid_adresse']),
            interop_key: pickString(row, ['cle_interop']),
            street: pickString(row, ['voie_nom']),
            lieu_dit: pickString(row, ['lieudit_complement_nom']),
            suffix: pickString(row, ['suffixe']),
            longitude: pickNumber(row, ['longitude']),
            latitude: pickNumber(row, ['latitude']),
            parcels: pickString(row, ['cad_parcelles']),
            last_update: pickString(row, ['date_der_maj']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search BAL Possession');
      }
    }
  );

  server.tool(
    'reunion_list_communes',
    'List the 24 communes of La Réunion with their full INSEE administrative attributes: name, INSEE code (5 digits, "974xx"), current code (handles fusions), EPCI code and name, zone d\'emploi 2020 name, bassin de vie 2022 name, department, region, year reference. Useful for territorial joins, statistical aggregation, administrative hierarchy reasoning. Use reunion_find_commune (commune module) for fuzzy commune resolution.',
    {
      epci_name: z.string().optional().describe('EPCI name prefix match. Réunion has 5 EPCIs: "CINOR" (north), "TCO" (west), "CIVIS" (south-west), "CASUD" (south), "CIREST" (east)'),
      limit: z.number().int().min(1).max(100).default(50).describe('Max communes to return (1-100, default 50). Réunion has 24 communes total'),
    },
    async ({ epci_name, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_COMMUNES, {
          where: buildWhere([epci_name ? `epci_name LIKE ${quote(`${epci_name}%`)}` : undefined]),
          limit,
        });
        return jsonResult({
          total_communes: data.total_count,
          communes: data.results.map((row) => ({
            name: pickString(row, ['com_name']),
            insee_code: pickString(row, ['com_code']),
            current_code: pickString(row, ['com_current_code']),
            epci_code: pickString(row, ['epci_code']),
            epci_name: pickString(row, ['epci_name']),
            employment_zone: pickString(row, ['ze2020_name']),
            living_basin: pickString(row, ['bv2022_name']),
            department: pickString(row, ['dep_name']),
            region: pickString(row, ['reg_name']),
            year: pickString(row, ['year']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to list communes');
      }
    }
  );

  server.tool(
    'reunion_list_cantons',
    'List the electoral cantons of La Réunion (used for departmental elections, "élections cantonales/départementales"). Each canton elects a binôme (2 conseillers départementaux). Returns canton code, name, current code (handles redistricting), type, department, region, central polling-bureau, year reference. Useful for electoral analysis, conseil départemental research.',
    {
      limit: z.number().int().min(1).max(100).default(50).describe('Max cantons to return (1-100, default 50)'),
    },
    async ({ limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_CANTONS, { limit });
        return jsonResult({
          total_cantons: data.total_count,
          cantons: data.results.map((row) => ({
            code: pickString(row, ['can_code']),
            name: pickString(row, ['can_name']),
            current_code: pickString(row, ['can_current_code']),
            type: pickString(row, ['can_type']),
            department: pickString(row, ['dep_name']),
            region: pickString(row, ['reg_name']),
            central_bureau: pickString(row, ['can_burcentral']),
            year: pickString(row, ['year']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to list cantons');
      }
    }
  );

    server.tool(
    'reunion_list_epci',
    'List EPCI (Établissements Publics de Coopération Intercommunale) covering La Réunion. Réunion has 5 communautés d\'agglomération grouping its 24 communes: CINOR (north), TCO (west), CIVIS (south-west), CASUD (south), CIREST (east). Returns EPCI code, name, current code (handles regroupings), type, department, region, year reference. Use to aggregate commune-level data at the inter-municipal level.',
    {},
    async () => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_EPCI, { limit: 100 });
        return jsonResult({
          total_epci: data.total_count,
          epci: data.results.map((row) => ({
            code: pickString(row, ['epci_code']),
            name: pickString(row, ['epci_name']),
            current_code: pickString(row, ['epci_current_code']),
            type: pickString(row, ['epci_type']),
            department: pickString(row, ['dep_name']),
            region: pickString(row, ['reg_name']),
            year: pickString(row, ['year']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to list EPCI');
      }
    }
  );

  server.tool(
    'reunion_list_iris',
    'List IRIS (Îlots Regroupés pour l\'Information Statistique) — INSEE\'s fine sub-communal statistical geography (~2000 inhabitants per zone), used for census, income, poverty, employment data. Returns IRIS code (9 digits), name, IRIS type (H = habitat, A = activité, D = divers), commune name and code, EPCI name, grand-quartier code and name, year reference. Combine with reunion_iris_profile (commune module) for cross-dataset IRIS analysis or reunion_get_income_poverty_by_iris (economy module).',
    {
      commune: z.string().optional().describe('Commune name prefix match'),
      limit: z.number().int().min(1).max(500).default(100).describe('Max IRIS to return (1-500, default 100)'),
    },
    async ({ commune, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_IRIS, {
          where: buildWhere([commune ? `com_name LIKE ${quote(`${commune}%`)}` : undefined]),
          limit,
        });
        return jsonResult({
          total_iris: data.total_count,
          iris: data.results.map((row) => ({
            code: pickString(row, ['iris_code']),
            name: pickString(row, ['iris_name']),
            type: pickString(row, ['iris_type']),
            commune_name: pickString(row, ['com_name']),
            commune_code: pickString(row, ['com_code']),
            epci_name: pickString(row, ['epci_name']),
            grand_quartier_code: pickString(row, ['iris_grd_quart_code']),
            grand_quartier_name: pickString(row, ['iris_grd_quart_name']),
            year: pickString(row, ['year']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to list IRIS');
      }
    }
  );

  server.tool(
    'reunion_list_saint_denis_quarters',
    'List the 20 official quarters (quartiers) of the city of Saint-Denis, capital of La Réunion. Saint-Denis is divided administratively into these named neighborhoods used for local-policy targeting, services planning, and citizen participation. Returns quarter name and source.',
    {},
    async () => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_SAINT_DENIS_QUARTERS, { limit: 50 });
        return jsonResult({
          total_quarters: data.total_count,
          quarters: data.results.map((row) => ({
            name: pickString(row, ['index']),
            source: pickString(row, ['source']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to list Saint-Denis quarters');
      }
    }
  );
}
