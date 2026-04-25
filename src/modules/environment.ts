// src/modules/environment.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, pickNumber, pickString, quote } from '../utils/helpers.js';

const DATASET_AIR_QUALITY = 'world-air-quality-openaq';
const DATASET_WASTE_TONNAGE = 'tonnage-dechets-menagers-et-assimiles-a-la-reunion';
const DATASET_RGE_COMPANIES = 'liste-des-entreprises-rge-2';
const DATASET_ZNIEFF = 'zones-naturelles-d-interet-ecologique-faunistique-et-floristique-a-la-reunion';
const DATASET_PNRUN = 'pnrun_2021';
const DATASET_PETROLEUM = 'donnees-locales-de-consommation-de-produits-petroliers-a-la-reunion';
const DATASET_WATER_POIS = 'les-points-d-activite-ou-d-interet-la-gestion-des-eaux';

export function registerEnvironmentTools(server: McpServer): void {
  server.tool(
    'reunion_get_air_quality',
    'Get air-quality measurements (PM2.5, PM10, NO2, O3, etc.) recorded at Réunion stations via OpenAQ.',
    {
      pollutant: z
        .enum(['pm25', 'pm10', 'no2', 'o3', 'so2', 'co', 'bc'])
        .optional()
        .describe('Pollutant filter (OpenAQ code)'),
      city: z.string().optional().describe('City filter (prefix match)'),
      limit: z.number().int().min(1).max(200).default(50),
    },
    async ({ pollutant, city, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_AIR_QUALITY, {
          where: buildWhere([
            `country = ${quote('FR')}`,
            `country_name_en = ${quote('France')}`,
            `search(${quote('Réunion')}) OR city LIKE ${quote('Saint-%')}`,
            pollutant ? `measurements_parameter = ${quote(pollutant)}` : undefined,
            city ? `city LIKE ${quote(`${city}%`)}` : undefined,
          ]),
          order_by: 'measurements_lastupdated DESC',
          limit,
        });

        return jsonResult({
          total_measurements: data.total_count,
          measurements: data.results.map((row) => ({
            city: pickString(row, ['city']),
            location: pickString(row, ['location']),
            pollutant: pickString(row, ['measurements_parameter']),
            value: pickNumber(row, ['measurements_value']),
            unit: pickString(row, ['measurements_unit']),
            last_updated: pickString(row, ['measurements_lastupdated']),
            source: pickString(row, ['measurements_sourcename']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch air quality');
      }
    }
  );

  server.tool(
    'reunion_get_waste_tonnage',
    'Annual tonnage of household & assimilated waste (DMA) collected in Réunion, by waste type.',
    {
      year: z.number().int().optional().describe('Year filter'),
      waste_type: z.string().optional().describe('Waste type filter (libellé, prefix match)'),
      limit: z.number().int().min(1).max(200).default(50),
    },
    async ({ year, waste_type, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_WASTE_TONNAGE, {
          where: buildWhere([
            year !== undefined ? `annee = ${year}` : undefined,
            waste_type ? `l_typ_reg_dechet LIKE ${quote(`${waste_type}%`)}` : undefined,
          ]),
          order_by: 'annee DESC',
          limit,
        });
        return jsonResult({
          total_rows: data.total_count,
          tonnage: data.results.map((row) => ({
            year: pickNumber(row, ['annee']),
            waste_type_code: pickString(row, ['c_typ_reg_dechet']),
            waste_type: pickString(row, ['l_typ_reg_dechet']),
            tonnage_t: pickNumber(row, ['tonnage_dma_t']),
            department: pickString(row, ['n_dept']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch waste tonnage');
      }
    }
  );

  server.tool(
    'reunion_search_rge_companies',
    'Search RGE-certified (eco-renovation) companies in Réunion.',
    {
      query: z.string().optional().describe('Free-text search'),
      commune: z.string().optional().describe('Commune filter (prefix match)'),
      domain: z.string().optional().describe('Domain filter (e.g. "Isolation", "Chauffage")'),
      limit: z.number().int().min(1).max(100).default(25),
    },
    async ({ query, commune, domain, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_RGE_COMPANIES, {
          where: buildWhere([
            query ? `search(${quote(query)})` : undefined,
            commune ? `commune LIKE ${quote(`${commune}%`)}` : undefined,
            domain ? `domaine LIKE ${quote(`${domain}%`)}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_companies: data.total_count,
          companies: data.results.map((row) => ({
            siret: pickString(row, ['siret']),
            name: pickString(row, ['nom_entreprise']),
            address: pickString(row, ['adresse']),
            postal_code: pickString(row, ['code_postal']),
            commune: pickString(row, ['commune']),
            phone: pickString(row, ['telephone']),
            email: pickString(row, ['email']),
            website: pickString(row, ['site_internet']),
            certification: pickString(row, ['nom_certificat']),
            qualification: pickString(row, ['nom_qualification']),
            domain: pickString(row, ['domaine']),
            meta_domain: pickString(row, ['meta_domaine']),
            organization: pickString(row, ['organisme']),
            lat: pickNumber(row, ['latitude']),
            lon: pickNumber(row, ['longitude']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search RGE companies');
      }
    }
  );

  server.tool(
    'reunion_list_znieff',
    'List ZNIEFF protected ecological/fauna/flora zones in Réunion.',
    {
      query: z.string().optional().describe('Free-text search on zone name'),
      limit: z.number().int().min(1).max(100).default(50),
    },
    async ({ query, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_ZNIEFF, {
          where: buildWhere([query ? `search(${quote(query)})` : undefined]),
          limit,
        });
        return jsonResult({
          total_zones: data.total_count,
          zones: data.results.map((row) => ({
            mnhn_id: pickString(row, ['id_mnhn']),
            org_id: pickString(row, ['id_org']),
            name: pickString(row, ['nom']),
            generation: pickString(row, ['generation']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to list ZNIEFF zones');
      }
    }
  );

  server.tool(
    'reunion_list_national_park_perimeters',
    'List perimeters of Parc national de La Réunion (core area, adherence area).',
    {},
    async () => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_PNRUN, { limit: 20 });
        return jsonResult({
          total_perimeters: data.total_count,
          perimeters: data.results.map((row) => ({
            type: pickString(row, ['type']),
            type_code: pickString(row, ['code_type']),
            surface: pickNumber(row, ['surface']),
            surface_ha: pickNumber(row, ['surf_ha']),
            decree: pickString(row, ['decret']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to list park perimeters');
      }
    }
  );

  server.tool(
    'reunion_get_petroleum_consumption',
    'Annual local consumption of petroleum products (gasoline, diesel, heating oil, LPG, jet fuel) in Réunion, in m³.',
    {
      year: z.number().int().optional().describe('Year filter'),
      limit: z.number().int().min(1).max(50).default(20),
    },
    async ({ year, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_PETROLEUM, {
          where: buildWhere([year !== undefined ? `annee = ${year}` : undefined]),
          order_by: 'annee DESC',
          limit,
        });
        return jsonResult({
          total_rows: data.total_count,
          consumption: data.results.map((row) => ({
            year: pickNumber(row, ['annee']),
            department: pickString(row, ['departement_libelle']),
            gasoline_m3: pickNumber(row, ['essence_m3']),
            diesel_m3: pickNumber(row, ['gazole_m3']),
            heating_oil_m3: pickNumber(row, ['fioul_m3']),
            lpg_m3: pickNumber(row, ['gpl_m3']),
            jet_fuel_m3: pickNumber(row, ['carbureacteur_m3']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch petroleum consumption');
      }
    }
  );

  server.tool(
    'reunion_list_water_management_points',
    'List points of activity / interest related to water management in La Réunion (intakes, treatment plants, etc.).',
    {
      nature: z.string().optional().describe('Nature filter (prefix match, e.g. "Captage")'),
      origine: z.string().optional().describe('Origin / source filter (prefix match)'),
      limit: z.number().int().min(1).max(200).default(50),
    },
    async ({ nature, origine, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_WATER_POIS, {
          where: buildWhere([
            nature ? `nature LIKE ${quote(`${nature}%`)}` : undefined,
            origine ? `origine LIKE ${quote(`${origine}%`)}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_points: data.total_count,
          points: data.results.map((row) => ({
            id: pickString(row, ['id']),
            origin: pickString(row, ['origine']),
            nature: pickString(row, ['nature']),
            toponym: pickString(row, ['toponyme']),
            importance: pickString(row, ['importance']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to list water points');
      }
    }
  );
}
