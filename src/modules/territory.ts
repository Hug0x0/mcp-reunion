// src/modules/territory.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, pickNumber, pickString, quote } from '../utils/helpers.js';

const DATASET_DVF = 'demande-de-valeurs-foncierespublic';
const DATASET_POPULATION = 'population-francaise-communespublic';
const DATASET_POSTAL = 'laposte_hexasmaldatanova';
const DATASET_LAND_POTENTIAL = 'potentiel-foncier';
const DATASET_RESIDENTIAL_PERMITS = 'liste-des-permis-de-construire-et-autres-autorisations-d-urbanisme-a-la-reunion';

export function registerTerritoryTools(server: McpServer): void {
  server.tool(
    'reunion_search_real_estate_transactions',
    'Search DVF real-estate transactions in La Réunion (land value declarations).',
    {
      year: z.number().int().optional().describe('Year of mutation'),
      insee: z.string().optional().describe('INSEE commune code filter'),
      type: z.string().optional().describe('Property type filter (prefix match on libtypbien)'),
      min_value: z.number().optional().describe('Minimum sale value (€)'),
      max_value: z.number().optional().describe('Maximum sale value (€)'),
      limit: z.number().int().min(1).max(200).default(50),
    },
    async ({ year, insee, type, min_value, max_value, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_DVF, {
          where: buildWhere([
            year !== undefined ? `anneemut = ${year}` : undefined,
            insee ? `l_codinsee LIKE ${quote(`%${insee}%`)}` : undefined,
            type ? `libtypbien LIKE ${quote(`${type}%`)}` : undefined,
            min_value !== undefined ? `valeurfonc >= ${min_value}` : undefined,
            max_value !== undefined ? `valeurfonc <= ${max_value}` : undefined,
          ]),
          order_by: 'datemut DESC',
          limit,
        });
        return jsonResult({
          total_transactions: data.total_count,
          transactions: data.results.map((row) => ({
            mutation_id: pickString(row, ['idmutation']),
            date: pickString(row, ['datemut']),
            year: pickNumber(row, ['anneemut']),
            nature: pickString(row, ['libnatmut']),
            vefa: pickString(row, ['vefa']),
            value_eur: pickNumber(row, ['valeurfonc']),
            insee_codes: pickString(row, ['l_codinsee']),
            land_area_m2: pickNumber(row, ['sterr']),
            built_area_m2: pickNumber(row, ['sbati']),
            nb_houses: pickNumber(row, ['nblocmai']),
            nb_apartments: pickNumber(row, ['nblocapt']),
            nb_commercial: pickNumber(row, ['nblocact']),
            type_code: pickString(row, ['codtypbien']),
            type_label: pickString(row, ['libtypbien']),
            department: pickString(row, ['dep_name']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search real-estate transactions');
      }
    }
  );

  server.tool(
    'reunion_get_commune_population',
    'Get INSEE millésimé population for Réunion communes.',
    {
      commune: z.string().optional().describe('Commune name filter (prefix match)'),
      year: z.number().int().optional().describe('Census reference year (annee_recensement)'),
      limit: z.number().int().min(1).max(500).default(100),
    },
    async ({ commune, year, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_POPULATION, {
          where: buildWhere([
            commune ? `nom_de_la_commune LIKE ${quote(`${commune}%`)}` : undefined,
            year !== undefined ? `annee_recensement = ${year}` : undefined,
          ]),
          order_by: 'annee_recensement DESC, population_totale DESC',
          limit,
        });
        return jsonResult({
          total_rows: data.total_count,
          populations: data.results.map((row) => ({
            insee_code: pickString(row, ['code_insee']),
            commune: pickString(row, ['nom_de_la_commune']),
            census_year: pickNumber(row, ['annee_recensement']),
            use_year: pickNumber(row, ['annee_utilisation']),
            municipal_population: pickNumber(row, ['population_municipale']),
            counted_apart: pickNumber(row, ['population_comptee_a_part']),
            total_population: pickNumber(row, ['population_totale']),
            area: pickNumber(row, ['superficie']),
            epci: pickString(row, ['libepci']),
            epci_code: pickString(row, ['code_epci']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch population');
      }
    }
  );

  server.tool(
    'reunion_lookup_postal_codes',
    'Look up La Poste postal codes for Réunion communes/hamlets.',
    {
      commune: z.string().optional().describe('Commune name filter (prefix match)'),
      postal_code: z.string().optional().describe('Exact postal code filter'),
      insee: z.string().optional().describe('INSEE commune code filter'),
      limit: z.number().int().min(1).max(200).default(50),
    },
    async ({ commune, postal_code, insee, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_POSTAL, {
          where: buildWhere([
            commune ? `nom_de_la_commune LIKE ${quote(`${commune}%`)}` : undefined,
            postal_code ? `code_postal = ${quote(postal_code)}` : undefined,
            insee ? `code_commune_insee = ${quote(insee)}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_rows: data.total_count,
          entries: data.results.map((row) => ({
            insee_code: pickString(row, ['code_commune_insee']),
            commune: pickString(row, ['nom_de_la_commune']),
            postal_code: pickString(row, ['code_postal']),
            line5: pickString(row, ['ligne_5']),
            delivery_label: pickString(row, ['libelle_d_acheminement']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to look up postal codes');
      }
    }
  );

  server.tool(
    'reunion_list_land_potential',
    'List "potentiel foncier" parcels (buildable/urbanizable land reserves) in La Réunion.',
    {
      insee: z.string().optional().describe('INSEE commune code filter'),
      quartier: z.string().optional().describe('Quartier filter (prefix match)'),
      zpu: z.string().optional().describe('ZPU (Plan d\'Urbanisme zone) filter'),
      limit: z.number().int().min(1).max(200).default(50),
    },
    async ({ insee, quartier, zpu, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_LAND_POTENTIAL, {
          where: buildWhere([
            insee ? `insee = ${quote(insee)}` : undefined,
            quartier ? `quartier LIKE ${quote(`${quartier}%`)}` : undefined,
            zpu ? `zpu LIKE ${quote(`${zpu}%`)}` : undefined,
          ]),
          order_by: 'surf_rp DESC',
          limit,
        });
        return jsonResult({
          total_parcels: data.total_count,
          parcels: data.results.map((row) => ({
            rp_number: pickString(row, ['num_rp']),
            area_m2: pickNumber(row, ['surf_rp']),
            insee: pickString(row, ['insee']),
            quartier: pickString(row, ['quartier']),
            zpu: pickString(row, ['zpu']),
            espacesar: pickString(row, ['espacesar']),
            label: pickString(row, ['libelle']),
            section: pickString(row, ['section']),
            parcelle: pickString(row, ['parcelle']),
            particular: pickString(row, ['particular']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to list land potential');
      }
    }
  );

  server.tool(
    'reunion_search_residential_permits',
    'Search construction permits creating dwellings (Sitadel) in La Réunion.',
    {
      commune: z.string().optional().describe('Commune filter (prefix match on adr_localite_ter)'),
      year: z.number().int().optional().describe('Year of deposit (an_depot)'),
      min_dwellings: z.number().int().optional().describe('Minimum dwellings created'),
      limit: z.number().int().min(1).max(200).default(50),
    },
    async ({ commune, year, min_dwellings, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_RESIDENTIAL_PERMITS, {
          where: buildWhere([
            commune ? `adr_localite_ter LIKE ${quote(`${commune}%`)}` : undefined,
            year !== undefined ? `an_depot = ${year}` : undefined,
            min_dwellings !== undefined ? `nb_lgt_tot_crees >= ${min_dwellings}` : undefined,
          ]),
          order_by: 'date_reelle_autorisation DESC',
          limit,
        });
        return jsonResult({
          total_permits: data.total_count,
          permits: data.results.map((row) => ({
            permit_number: pickString(row, ['num_dau']),
            permit_type: pickString(row, ['type_dau']),
            status: pickString(row, ['etat_dau']),
            authorization_date: pickString(row, ['date_reelle_autorisation']),
            deposit_year: pickNumber(row, ['an_depot']),
            applicant_name: pickString(row, ['denom_dem']),
            applicant_siren: pickString(row, ['siren_dem']),
            address: pickString(row, ['adr_libvoie_ter']),
            commune: pickString(row, ['adr_localite_ter']),
            postal_code: pickString(row, ['adr_codpost_ter']),
            land_area_m2: pickNumber(row, ['superficie_terrain']),
            total_dwellings_created: pickNumber(row, ['nb_lgt_tot_crees']),
            individual_dwellings: pickNumber(row, ['nb_lgt_ind_crees']),
            collective_dwellings: pickNumber(row, ['nb_lgt_col_crees']),
            dwellings_demolished: pickNumber(row, ['nb_lgt_demolis']),
            social_rental: pickNumber(row, ['nb_lgt_pret_loc_social']),
            living_area_created_m2: pickNumber(row, ['surf_hab_creee']),
            main_use: pickString(row, ['destination_principale']),
            project_nature: pickString(row, ['nature_projet_declaree']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search residential permits');
      }
    }
  );
}
