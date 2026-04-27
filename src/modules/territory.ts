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
    'Search the DVF (Demande de Valeurs Foncières) database — France\'s open record of real-estate transactions registered with notaires — restricted to La Réunion. Each row is one mutation (sale, exchange, etc.) with date, value, property characteristics. Returns mutation ID, date, year, nature of mutation, VEFA flag (sale of future state of completion), sale value (EUR), INSEE codes, land area, built area, counts of houses/apartments/commercial premises, type code and label, department. Sorted by date descending. Use for price analysis, market trends, comparable sales.',
    {
      year: z.number().int().optional().describe('Year of mutation (4 digits, e.g. 2023)'),
      insee: z.string().optional().describe('INSEE commune code (5 digits as string, e.g. "97411" for Saint-Denis). Substring match supported'),
      type: z.string().optional().describe('Property type label prefix match (libtypbien). Examples: "MAISON", "APPARTEMENT", "DEPENDANCE", "TERRAIN"'),
      min_value: z.number().optional().describe('Minimum sale value in EUR (inclusive)'),
      max_value: z.number().optional().describe('Maximum sale value in EUR (inclusive)'),
      limit: z.number().int().min(1).max(200).default(50).describe('Max transactions to return (1-200, default 50)'),
    },
    async ({ year, insee, type, min_value, max_value, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_DVF, {
          where: buildWhere([
            year !== undefined ? `datemut >= date'${year}-01-01' AND datemut < date'${year + 1}-01-01'` : undefined,
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
    'INSEE official millésimé population counts for La Réunion communes. INSEE provides three population figures: municipal (people legally living in the commune), counted apart (e.g. students living elsewhere but counted at parents\' home), and total (sum). Each row is one commune × one census year. Returns INSEE code, commune name, census year (the year the data was collected), use year (the year the figures officially apply), municipal/counted-apart/total populations, surface area, EPCI. Sorted by census year descending then total population descending.',
    {
      commune: z.string().optional().describe('Commune name prefix match (e.g. "Saint-Denis")'),
      year: z.number().int().optional().describe('Census reference year (4 digits, INSEE publishes a "millésime" each year)'),
      limit: z.number().int().min(1).max(500).default(100).describe('Max rows to return (1-500, default 100)'),
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
    'Look up the official La Poste postal-code database for La Réunion communes and hamlets (Hexasmal). One commune may have multiple postal codes (per neighborhood / lieu-dit). Returns INSEE commune code, commune name, postal code, line 5 (extra mention for delivery), official delivery label. Use to map between INSEE codes, postal codes, and delivery labels for normalization.',
    {
      commune: z.string().optional().describe('Commune name prefix match'),
      postal_code: z.string().optional().describe('Exact postal code (5 digits string, Réunion uses "974xx")'),
      insee: z.string().optional().describe('Exact INSEE commune code (5 digits string)'),
      limit: z.number().int().min(1).max(200).default(50).describe('Max entries to return (1-200, default 50)'),
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
    'List "potentiel foncier" parcels in La Réunion — identified land reserves with potential for urbanization or development under current planning documents. Each row is one cadastral parcel with measured area, location attributes, and PLU zone. Returns RP number, area in m², INSEE, quartier, ZPU code, espacesar, label, cadastral section, parcelle, particulars. Sorted by area descending. Useful for SCOT / PLU work, real-estate development scouting, urban-strategy planning.',
    {
      insee: z.string().optional().describe('Exact INSEE commune code (5 digits)'),
      quartier: z.string().optional().describe('Quartier name prefix match'),
      zpu: z.string().optional().describe('ZPU (Zone du Plan d\'Urbanisme) prefix match. Examples: "U", "AU", "A", "N"'),
      limit: z.number().int().min(1).max(200).default(50).describe('Max parcels to return (1-200, default 50)'),
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
    'Search construction-permit applications that create dwellings (logements) in La Réunion, from the Sitadel database. Each row is one permit application with detailed dwelling counts. Returns permit number, type (PC/DP/PA), status, authorization date, deposit year, applicant identity (name, SIREN), site address, terrain area, total dwellings created (split into individual / collective / demolished / social-rental), living area created (m²), main use, project nature. Sorted by authorization date descending. Useful for housing-supply analysis, market intelligence, developer tracking. For non-residential permits use reunion_search_building_permits.',
    {
      commune: z.string().optional().describe('Commune (locality) name prefix match on the project address'),
      year: z.number().int().optional().describe('Year of permit deposit (4 digits)'),
      min_dwellings: z.number().int().optional().describe('Minimum number of dwellings created (filters out small projects)'),
      limit: z.number().int().min(1).max(200).default(50).describe('Max permits to return (1-200, default 50)'),
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
