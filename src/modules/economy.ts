// src/modules/economy.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, pickNumber, pickString, quote } from '../utils/helpers.js';

const DATASET_SIRENE = 'base-sirene-v3-lareunion';
const DATASET_CPI = 'insee-indices-des-prix-a-la-consommation-a-la-reunion-valeurs-mensuelles';
const DATASET_FEDER = 'liste_des_operations_31';
const DATASET_COWORKING = 'espace-de-coworkings-sur-l-ile-de-la-reunion';
const DATASET_INCOME_IRIS = 'revenus-declares-pauvrete-et-niveau-de-vie-en-2015-irispublic';

export function registerEconomyTools(server: McpServer): void {
  server.tool(
    'reunion_search_sirene_establishments',
    'Search the SIRENE v3 national business registry, restricted to establishments located in La Réunion. Each establishment has a 14-digit SIRET (= 9-digit SIREN of the legal entity + 5-digit NIC). Returns SIREN/SIRET, denomination, usual name, brand, head-office flag, administrative state (active/closed), creation date, NAF activity code, workforce bracket, full address, postal code, commune, legal form, ESS (économie sociale et solidaire) status. Source: INSEE Sirene via data.regionreunion.com.',
    {
      query: z.string().optional().describe('Free-text search across denomination, usual name, brand, address, activity'),
      siren: z.string().optional().describe('Exact 9-digit SIREN of the legal entity (unité légale)'),
      siret: z.string().optional().describe('Exact 14-digit SIRET of the establishment'),
      commune: z.string().optional().describe('Commune name prefix match (e.g. "Saint-Denis")'),
      naf: z.string().optional().describe('NAF/APE activity code prefix match. Examples: "47" for retail, "47.11" for hypermarkets, "56.10A" for traditional restaurants, "62" for IT'),
      limit: z.number().int().min(1).max(100).default(25).describe('Max establishments to return (1-100, default 25)'),
    },
    async ({ query, siren, siret, commune, naf, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_SIRENE, {
          where: buildWhere([
            query ? `search(${quote(query)})` : undefined,
            siren ? `siren = ${quote(siren)}` : undefined,
            siret ? `siret = ${quote(siret)}` : undefined,
            commune ? `libellecommuneetablissement LIKE ${quote(`${commune}%`)}` : undefined,
            naf ? `activiteprincipaleetablissement LIKE ${quote(`${naf}%`)}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_establishments: data.total_count,
          establishments: data.results.map((row) => ({
            siren: pickString(row, ['siren']),
            siret: pickString(row, ['siret']),
            denomination: pickString(row, ['denominationunitelegale']),
            usual_name: pickString(row, ['denominationusuelleetablissement']),
            brand: pickString(row, ['enseigne1etablissement']),
            is_head_office: pickString(row, ['etablissementsiege']),
            state: pickString(row, ['etatadministratifetablissement']),
            creation_date: pickString(row, ['datecreationetablissement']),
            activity_code: pickString(row, ['activiteprincipaleetablissement']),
            workforce_bracket: pickString(row, ['trancheeffectifsetablissement']),
            workforce_year: pickString(row, ['anneeeffectifsetablissement']),
            address: pickString(row, ['adresseetablissement']),
            postal_code: pickString(row, ['codepostaletablissement']),
            commune: pickString(row, ['libellecommuneetablissement']),
            legal_form: pickString(row, ['categoriejuridiqueunitelegale']),
            ess: pickString(row, ['economiesocialesolidaireunitelegale']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search SIRENE');
      }
    }
  );

  server.tool(
    'reunion_get_consumer_price_index',
    'INSEE monthly Indice des Prix à la Consommation (IPC, consumer price index) for La Réunion. Time series broken down by COICOP category (Classification of Individual Consumption by Purpose) and population (whole population vs urban households). Use it to track inflation, deflate nominal values to real, or compare price evolution across categories (food, energy, housing, transport, etc.). Returns period, COICOP code/label, base year, population, zone, IDBANK identifier, index value. Sorted most recent first.',
    {
      period: z.string().optional().describe('Period prefix match in YYYY-MM format. Examples: "2023" (whole year), "2023-12" (specific month)'),
      coicop_code: z.string().optional().describe('COICOP category code prefix. Examples: "01" food and beverages, "02" alcohol/tobacco, "04" housing/water/energy, "07" transport, "11" restaurants/hotels, "00" general index'),
      type: z.string().optional().describe('Type label prefix match (e.g. "Indice général", "Indice mensuel")'),
      limit: z.number().int().min(1).max(500).default(100).describe('Max rows to return (1-500, default 100)'),
    },
    async ({ period, coicop_code, type, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_CPI, {
          where: buildWhere([
            period ? `periode LIKE ${quote(`${period}%`)}` : undefined,
            coicop_code ? `coicop_code LIKE ${quote(`${coicop_code}%`)}` : undefined,
            type ? `type LIKE ${quote(`${type}%`)}` : undefined,
          ]),
          order_by: 'periode DESC',
          limit,
        });
        return jsonResult({
          total_rows: data.total_count,
          series: data.results.map((row) => ({
            period: pickString(row, ['periode']),
            code: pickString(row, ['code']),
            type: pickString(row, ['type']),
            sub_type: pickString(row, ['sous_type']),
            coicop_code: pickString(row, ['coicop_code']),
            coicop_label: pickString(row, ['coicop_texte']),
            base: pickString(row, ['base']),
            population: pickString(row, ['population']),
            zone: pickString(row, ['zone']),
            index_name: pickString(row, ['indice']),
            value: pickNumber(row, ['valeur']),
            idbank: pickString(row, ['insee_idbank']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch CPI');
      }
    }
  );

  server.tool(
    'reunion_search_feder_beneficiaries',
    'Search beneficiaries of the European Regional Development Fund (FEDER / ERDF) 2014-2020 programming period in La Réunion. Returns funded operations: beneficiary name, operation title and summary, start/end dates, total eligible expenditure (EUR), EU contribution (EUR), location (postal code, city), intervention category (e.g. R&D, infrastructure, SMEs, environment). Sorted by start date descending. Useful to map EU-funded projects, audit transparency, or analyze regional development patterns.',
    {
      query: z.string().optional().describe('Free-text search across beneficiary name, operation title, summary'),
      commune: z.string().optional().describe('City/commune name prefix match'),
      category: z.string().optional().describe('Intervention category prefix match. Examples: "Recherche et innovation", "PME", "Économie à faibles émissions", "Infrastructures de transport"'),
      limit: z.number().int().min(1).max(200).default(50).describe('Max operations to return (1-200, default 50)'),
    },
    async ({ query, commune, category, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_FEDER, {
          where: buildWhere([
            query ? `search(${quote(query)})` : undefined,
            commune ? `ville LIKE ${quote(`${commune}%`)}` : undefined,
            category ? `categorie_d_intervention_category_of_intervention LIKE ${quote(`${category}%`)}` : undefined,
          ]),
          order_by: 'date_de_debut_de_l_operation_start_date DESC',
          limit,
        });
        return jsonResult({
          total_operations: data.total_count,
          operations: data.results.map((row) => ({
            beneficiary: pickString(row, ['nom_du_beneficiaire_beneficiary']),
            operation: pickString(row, ['nom_de_l_operation_operation']),
            summary: pickString(row, ['resume_de_l_operation_summary']),
            start_date: pickString(row, ['date_de_debut_de_l_operation_start_date']),
            end_date: pickString(row, ['date_de_fin_de_l_operation_end_date']),
            total_eligible_eur: pickNumber(row, ['total_des_depenses_eligibles_total_eligible_expenditure']),
            eu_share_eur: pickNumber(row, ['ue']),
            postal_code: pickString(row, ['cp']),
            city: pickString(row, ['ville']),
            intervention_category: pickString(row, ['categorie_d_intervention_category_of_intervention']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search FEDER');
      }
    }
  );

  server.tool(
    'reunion_list_coworking_spaces',
    'List coworking spaces and shared offices in La Réunion (tiers-lieux numériques, espaces partagés, fab labs sometimes). Returns name, type, website, coarse location (zone), full address, email, phone, dataset page URL. Useful for remote workers, freelancers, business travelers needing flexible workspace.',
    {
      commune: z.string().optional().describe('Coarse-location prefix match (typically a region or commune name like "Saint-Denis", "Saint-Pierre", "Le Tampon")'),
      limit: z.number().int().min(1).max(100).default(50).describe('Max spaces to return (1-100, default 50)'),
    },
    async ({ commune, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_COWORKING, {
          where: buildWhere([commune ? `coarse_location LIKE ${quote(`${commune}%`)}` : undefined]),
          limit,
        });
        return jsonResult({
          total_spaces: data.total_count,
          spaces: data.results.map((row) => ({
            name: pickString(row, ['name']),
            type: pickString(row, ['type']),
            website: pickString(row, ['website']),
            coarse_location: pickString(row, ['coarse_location']),
            address: pickString(row, ['address']),
            email: pickString(row, ['email']),
            phone: pickString(row, ['phone']),
            page_url: pickString(row, ['page_url']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to list coworking spaces');
      }
    }
  );

  server.tool(
    'reunion_get_income_poverty_by_iris',
    'INSEE Filosofi income, poverty and standard-of-living indicators at IRIS level (2014 reference year) for La Réunion. IRIS are sub-communal statistical zones (~2000 inhabitants each, used for fine-grained territorial analysis). Returns: IRIS code/label, commune, household population, poverty rate %, median disposable income, Q1/Q3/D1/D9 quartiles/deciles, interdecile ratio, Gini coefficient, share of income from wages/unemployment/social benefits/pensions. Use reunion_iris_profile (commune module) for a cross-dataset IRIS view.',
    {
      iris: z.string().optional().describe('Exact 9-digit IRIS code (e.g. "974010101")'),
      commune: z.string().optional().describe('Commune name prefix match'),
      limit: z.number().int().min(1).max(500).default(100).describe('Max IRIS rows to return (1-500, default 100)'),
    },
    async ({ iris, commune, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_INCOME_IRIS, {
          where: buildWhere([
            iris ? `iris = ${quote(iris)}` : undefined,
            commune ? `libcom LIKE ${quote(`${commune}%`)}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_iris: data.total_count,
          rows: data.results.map((row) => ({
            iris_code: pickString(row, ['iris']),
            iris_label: pickString(row, ['libiris']),
            commune_code: pickString(row, ['com']),
            commune: pickString(row, ['libcom']),
            households_population_2014: pickNumber(row, ['pop_menages_en_2014_princ']),
            poverty_rate_pct: pickNumber(row, ['dec_tp6014']),
            median_income: pickNumber(row, ['dec_med14']),
            q1_income: pickNumber(row, ['dec_q114']),
            q3_income: pickNumber(row, ['dec_q314']),
            d1_income: pickNumber(row, ['dec_d114']),
            d9_income: pickNumber(row, ['dec_d914']),
            interdecile_ratio: pickNumber(row, ['dec_rd14']),
            gini: pickNumber(row, ['dec_gi14']),
            share_wages_pct: pickNumber(row, ['dec_ptsa14']),
            share_unemployment_pct: pickNumber(row, ['dec_pcho14']),
            share_benefits_pct: pickNumber(row, ['dec_pben14']),
            share_pensions_pct: pickNumber(row, ['dec_ppen14']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch income/poverty by IRIS');
      }
    }
  );
}
