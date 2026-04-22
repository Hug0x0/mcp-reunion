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
    'Search active SIRENE v3 establishments in La Réunion.',
    {
      query: z.string().optional().describe('Free-text search (name, brand, activity...)'),
      siren: z.string().optional().describe('SIREN filter (exact)'),
      siret: z.string().optional().describe('SIRET filter (exact)'),
      commune: z.string().optional().describe('Commune filter (prefix match)'),
      naf: z.string().optional().describe('Activité principale NAF code (prefix match)'),
      limit: z.number().int().min(1).max(100).default(25),
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
    'Get INSEE monthly consumer price index (IPC) values for La Réunion.',
    {
      period: z.string().optional().describe('Period filter (YYYY-MM prefix)'),
      coicop_code: z.string().optional().describe('COICOP category code (e.g. "01" food) prefix match'),
      type: z.string().optional().describe('Type filter (prefix match)'),
      limit: z.number().int().min(1).max(500).default(100),
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
    'Search FEDER 2014-2020 beneficiaries in La Réunion (EU Regional Development Fund).',
    {
      query: z.string().optional().describe('Free-text search (beneficiary name, operation...)'),
      commune: z.string().optional().describe('City filter (prefix match)'),
      category: z.string().optional().describe('Intervention category filter (prefix match)'),
      limit: z.number().int().min(1).max(200).default(50),
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
    'List coworking spaces in La Réunion.',
    {
      commune: z.string().optional().describe('Coarse location filter (prefix match)'),
      limit: z.number().int().min(1).max(100).default(50),
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
    'Income, poverty and standard-of-living indicators at IRIS level (2014) in La Réunion.',
    {
      iris: z.string().optional().describe('IRIS code filter (exact)'),
      commune: z.string().optional().describe('Commune name filter (prefix match on libcom)'),
      limit: z.number().int().min(1).max(500).default(100),
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
