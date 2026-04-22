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
    'Search normalized Base Adresse Nationale (BAN) addresses in Réunion. ~353k addresses.',
    {
      query: z.string().optional().describe('Free-text search on street / city'),
      commune: z.string().optional().describe('Commune name filter (prefix match)'),
      insee: z.number().int().optional().describe('INSEE commune code filter'),
      postal_code: z.number().int().optional().describe('Postal code filter'),
      limit: z.number().int().min(1).max(100).default(20),
    },
    async ({ query, commune, insee, postal_code, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_BAN, {
          where: buildWhere([
            query ? `search(${quote(query)})` : undefined,
            commune ? `nom_commune LIKE ${quote(`${commune}%`)}` : undefined,
            insee !== undefined ? `code_insee = ${insee}` : undefined,
            postal_code !== undefined ? `code_postal = ${postal_code}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_addresses: data.total_count,
          addresses: data.results.map((row) => ({
            number: pickNumber(row, ['numero']),
            suffix: pickString(row, ['rep']),
            street: pickString(row, ['nom_voie']),
            postal_code: pickNumber(row, ['code_postal']),
            insee_code: pickNumber(row, ['code_insee']),
            commune: pickString(row, ['nom_commune']),
            lon: pickNumber(row, ['lon']),
            lat: pickNumber(row, ['lat']),
            position_type: pickString(row, ['type_position']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search BAN addresses');
      }
    }
  );

  server.tool(
    'reunion_search_bal_possession',
    'Search the Base Adresse Locale (BAL) published directly by the Commune of La Possession.',
    {
      query: z.string().optional(),
      street: z.string().optional().describe('Street name filter (prefix match)'),
      limit: z.number().int().min(1).max(100).default(20),
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
    'List Réunion communes with their INSEE code, EPCI, zone d\'emploi, bassin de vie, department and region.',
    {
      epci_name: z.string().optional().describe('EPCI name filter (prefix match)'),
      limit: z.number().int().min(1).max(100).default(50),
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
    'List Réunion electoral cantons.',
    {
      limit: z.number().int().min(1).max(100).default(50),
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
    'List Réunion EPCI (intercommunalités / métropoles / communautés d\'agglomération).',
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
    'List Réunion IRIS (fine statistical geography used by INSEE for census/inequality analysis).',
    {
      commune: z.string().optional().describe('Commune name filter (prefix match)'),
      limit: z.number().int().min(1).max(500).default(100),
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
    'List the 20 official quarters of the City of Saint-Denis (Réunion).',
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
