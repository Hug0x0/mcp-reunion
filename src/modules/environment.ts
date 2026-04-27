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
    'Air-quality station measurements in La Réunion exposed via OpenAQ. Each row is one measurement at one station for one pollutant. Returns city, location/station, pollutant code, value, unit, last update timestamp, source name. Sorted by last-update descending. Useful for environmental monitoring, public-health analysis, pollution-event tracking.',
    {
      pollutant: z
        .enum(['pm25', 'pm10', 'no2', 'o3', 'so2', 'co', 'bc'])
        .optional()
        .describe('Pollutant filter (OpenAQ code): pm25 (fine particles ≤2.5µm), pm10 (≤10µm), no2 (nitrogen dioxide), o3 (ozone), so2 (sulfur dioxide), co (carbon monoxide), bc (black carbon)'),
      city: z.string().optional().describe('City name prefix match (e.g. "Saint-Denis", "Le Port")'),
      limit: z.number().int().min(1).max(200).default(50).describe('Max measurements to return (1-200, default 50)'),
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
    'Annual tonnage of Déchets Ménagers et Assimilés (DMA, household + assimilated waste) collected in La Réunion, broken down by waste type (ordures ménagères résiduelles, collecte sélective, déchèteries, encombrants, déchets verts, etc.). Returns year, waste-type code and label, tonnage in tonnes, department. Sorted by year descending. Source: SINOE / ADEME via data.regionreunion.com. Use for waste-policy monitoring, recycling rate analysis.',
    {
      year: z.number().int().optional().describe('Year filter (4 digits, e.g. 2022)'),
      waste_type: z.string().optional().describe('Waste-type label prefix. Examples: "Ordures ménagères résiduelles", "Collecte sélective", "Déchets verts", "Encombrants", "Déchèteries"'),
      limit: z.number().int().min(1).max(200).default(50).describe('Max rows to return (1-200, default 50)'),
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
    'Search companies certified RGE (Reconnu Garant de l\'Environnement) in La Réunion. RGE certification is required for clients to qualify for state aids on energy-renovation work (MaPrimeRénov\', éco-PTZ, CEE). Returns SIRET, company name, address, postal code, commune, phone, email, website, certification name, qualification, domain (insulation/heating/PV/...), meta-domain, certifying organization, lat/lon. Source: ADEME via data.regionreunion.com.',
    {
      query: z.string().optional().describe('Free-text search across company name, address, certification'),
      commune: z.string().optional().describe('Commune name prefix match'),
      domain: z.string().optional().describe('Specific domain prefix match. Examples: "Isolation", "Chauffage", "Photovoltaïque", "Eau chaude sanitaire", "Pompe à chaleur"'),
      limit: z.number().int().min(1).max(100).default(25).describe('Max companies to return (1-100, default 25)'),
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
    'List Zones Naturelles d\'Intérêt Écologique, Faunistique et Floristique (ZNIEFF) in La Réunion — official inventory of areas of high ecological value, used for biodiversity protection and as a reference in land-use decisions. Réunion has type-1 (small precise zones with rare species) and type-2 (large functional ecosystems). Returns MNHN ID, organization ID, zone name, generation. Source: MNHN / DEAL via data.regionreunion.com.',
    {
      query: z.string().optional().describe('Free-text search on zone name (e.g. "Piton", "Mafate", "Volcan")'),
      limit: z.number().int().min(1).max(100).default(50).describe('Max zones to return (1-100, default 50)'),
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
    'List the official perimeters of the Parc National de La Réunion (created in 2007, UNESCO World Heritage since 2010): the core protected area (cœur de parc, ~42% of the island) and the adherence area (aire d\'adhésion). Returns perimeter type, type code, surface (raw and in hectares), founding decree reference. Useful for environmental impact assessment, hiking-permit logic, conservation analysis.',
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
    'Annual local consumption of petroleum products in La Réunion, in cubic meters (m³), broken down by product: gasoline (essence), diesel (gazole), heating oil (fioul), LPG (gaz de pétrole liquéfié), jet fuel (carburéacteur). Useful for energy-transition monitoring, GHG emission estimates, transport-policy analysis. Sorted by year descending. Source: SDES (Service des données et études statistiques) via data.regionreunion.com.',
    {
      year: z.number().int().optional().describe('Year filter (4 digits, e.g. 2022)'),
      limit: z.number().int().min(1).max(50).default(20).describe('Max yearly rows to return (1-50, default 20)'),
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
    'List points of activity / interest related to water management in La Réunion: water intakes (captages), treatment plants (stations d\'épuration / potabilisation), reservoirs, pumping stations, etc. Returns ID, origin/source, nature, toponym, importance level. Useful for water-resource analysis, infrastructure mapping, environmental studies.',
    {
      nature: z.string().optional().describe('Nature prefix match. Examples: "Captage", "Station de traitement", "Forage", "Réservoir", "Pompage"'),
      origine: z.string().optional().describe('Origin / source prefix match (organization that produced the data)'),
      limit: z.number().int().min(1).max(200).default(50).describe('Max points to return (1-200, default 50)'),
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
