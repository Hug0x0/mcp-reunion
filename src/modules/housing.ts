// src/modules/housing.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, pickNumber, pickString, quote } from '../utils/helpers.js';

const DATASET_HOUSING = 'logements-et-logements-sociaux-dans-les-departements-a-la-reunion';
const DATASET_SOCIAL_COSTS = 'couts-et-surfaces-moyens-des-logements-sociaux-a-la-reunion';

export function registerHousingTools(server: McpServer): void {
  server.tool(
    'reunion_get_housing_overview',
    'Get Réunion housing overview (population, housing stock, social-housing share, vacancy) from the Banque des Territoires atlas.',
    {
      year: z.string().optional().describe('Publication year filter, e.g. "2024"'),
      limit: z.number().int().min(1).max(50).default(20),
    },
    async ({ year, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_HOUSING, {
          where: buildWhere([year ? `annee_publication = date${quote(`${year}-01-01`)}` : undefined]),
          order_by: 'annee_publication DESC',
          limit,
        });
        return jsonResult({
          total_snapshots: data.total_count,
          snapshots: data.results.map((row) => ({
            publication_year: pickString(row, ['annee_publication']),
            department: pickString(row, ['nom_departement']),
            population: pickNumber(row, ['nombre_d_habitants']),
            density_per_km2: pickNumber(row, ['densite_de_population_au_km2']),
            population_change_10y_pct: pickNumber(row, ['variation_de_la_population_sur_10_ans_en']),
            pct_under_20: pickNumber(row, ['population_de_moins_de_20_ans']),
            pct_60_plus: pickNumber(row, ['population_de_60_ans_et_plus']),
            unemployment_rate_pct: pickNumber(row, ['taux_de_chomage_au_t4_en']),
            poverty_rate_pct: pickNumber(row, ['taux_de_pauvrete_en']),
            total_housing: pickNumber(row, ['nombre_de_logements']),
            principal_residences: pickNumber(row, ['nombre_de_residences_principales']),
            social_housing_rate_pct: pickNumber(row, ['taux_de_logements_sociaux_en']),
            vacancy_rate_pct: pickNumber(row, ['taux_de_logements_vacants_en']),
            individual_housing_rate_pct: pickNumber(row, ['taux_de_logements_individuels_en']),
            social_stock_count: pickNumber(row, ['parc_social_nombre_de_logements']),
            social_avg_rent_eur_m2: pickNumber(row, ['parc_social_loyer_moyen_en_eur_m2_mois']),
            social_avg_age_years: pickNumber(row, ['parc_social_age_moyen_du_parc_en_annees']),
            social_energy_poor_rate_pct: pickNumber(row, ['parc_social_taux_de_logements_energivores_e_f_g_en']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch housing overview');
      }
    }
  );

  server.tool(
    'reunion_get_social_housing_costs',
    'Get median surfaces and cost per m² of social housing (construction and rehabilitation) in Réunion.',
    {
      year: z.string().optional().describe('Signature year filter, e.g. "2023"'),
      limit: z.number().int().min(1).max(50).default(20),
    },
    async ({ year, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_SOCIAL_COSTS, {
          where: buildWhere([year ? `annee_signature = ${quote(year)}` : undefined]),
          order_by: 'annee_signature DESC',
          limit,
        });
        return jsonResult({
          total_years: data.total_count,
          series: data.results.map((row) => ({
            year: pickString(row, ['annee_signature']),
            construction_median_surface_m2: pickNumber(row, ['construction_surface_mediane_des_operations_m2_su']),
            construction_median_cost_per_m2_eur: pickNumber(row, ['construction_prix_de_revient_median_au_m2_des_operations']),
            construction_median_cost_per_unit_eur: pickNumber(row, ['construction_prix_de_revient_median_des_operations_au_logement']),
            rehab_median_surface_m2: pickNumber(row, ['rehabilitation_surface_mediane_des_operations_m2_su']),
            rehab_median_cost_per_m2_eur: pickNumber(row, ['rehabilitation_prix_de_revient_median_au_m2_des_operations']),
            rehab_median_cost_per_unit_eur: pickNumber(row, ['rehabilitation_prix_de_revient_median_des_operations_au_logement']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch social housing costs');
      }
    }
  );
}
