// src/modules/social.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, pickNumber, pickString, quote } from '../utils/helpers.js';

const DATASET_CAF_BENEFICIARIES = 'beneficiaires-presta-sociales-caf-lareunion';
const DATASET_CAF_AMOUNTS = 'montant-presta-sociales-caf-lareunion';
const DATASET_CHILDCARE_SAINT_DENIS = 'etablissements-accueil-jeunes-enfants-villesaintdenis';
const DATASET_CHILDCARE_POSSESSION = 'etablissements-d-accueil-des-jeunes-enfants-de-la-possession';

export function registerSocialTools(server: McpServer): void {
  server.tool(
    'reunion_get_caf_beneficiaries',
    'Monthly counts of beneficiaries of CAF (Caisse d\'Allocations Familiales) social benefits in La Réunion. Each row is one (month × benefit type). Covers RSA (revenu de solidarité active), AAH (allocation aux adultes handicapés), prestations familiales (allocations familiales, ASF, complément familial), prestations logement (APL, ALS, ALF), prime d\'activité, etc. Returns date, benefit type, beneficiary count. Sorted by date descending. Combine with reunion_get_caf_amounts for total euros paid.',
    {
      benefit_type: z.string().optional().describe('Benefit type label prefix match. Examples: "RSA", "AAH", "Prime d\'activité", "Allocations familiales", "APL"'),
      from: z.string().optional().describe('Inclusive lower bound on date, ISO format YYYY-MM-DD'),
      to: z.string().optional().describe('Inclusive upper bound on date, ISO format YYYY-MM-DD'),
      limit: z.number().int().min(1).max(500).default(50).describe('Max rows to return (1-500, default 50)'),
    },
    async ({ benefit_type, from, to, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_CAF_BENEFICIARIES, {
          where: buildWhere([
            benefit_type ? `type_prestation LIKE ${quote(`${benefit_type}%`)}` : undefined,
            from ? `date >= date${quote(from)}` : undefined,
            to ? `date <= date${quote(to)}` : undefined,
          ]),
          order_by: 'date DESC',
          limit,
        });
        return jsonResult({
          total_rows: data.total_count,
          series: data.results.map((row) => ({
            date: pickString(row, ['date']),
            benefit_type: pickString(row, ['type_prestation']),
            beneficiaries: pickNumber(row, ['nbbeneficiaires']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch CAF beneficiaries');
      }
    }
  );

  server.tool(
    'reunion_get_caf_amounts',
    'Monthly total amounts (in EUR) paid out by CAF Réunion for each social-benefit category. Each row is one (month × benefit type) with the cumulated payouts for that category. Useful for public-spending analysis, social-policy monitoring, comparison with beneficiary counts (use reunion_get_caf_beneficiaries to derive average per beneficiary). Sorted by date descending.',
    {
      benefit_type: z.string().optional().describe('Benefit type label prefix match. Examples: "RSA", "AAH", "Prime d\'activité", "Allocations familiales"'),
      from: z.string().optional().describe('Inclusive lower bound on date, ISO format YYYY-MM-DD'),
      to: z.string().optional().describe('Inclusive upper bound on date, ISO format YYYY-MM-DD'),
      limit: z.number().int().min(1).max(500).default(50).describe('Max rows to return (1-500, default 50)'),
    },
    async ({ benefit_type, from, to, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_CAF_AMOUNTS, {
          where: buildWhere([
            benefit_type ? `type_de_prestation LIKE ${quote(`${benefit_type}%`)}` : undefined,
            from ? `date >= date${quote(from)}` : undefined,
            to ? `date <= date${quote(to)}` : undefined,
          ]),
          order_by: 'date DESC',
          limit,
        });
        return jsonResult({
          total_rows: data.total_count,
          series: data.results.map((row) => ({
            date: pickString(row, ['date']),
            benefit_type: pickString(row, ['type_de_prestation']),
            amount_eur: pickNumber(row, ['montant']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch CAF amounts');
      }
    }
  );

  server.tool(
    'reunion_list_childcare_facilities',
    'List early-childhood care facilities (Etablissements d\'Accueil du Jeune Enfant, EAJE) in Saint-Denis or La Possession — currently the only two communes publishing this dataset. Covers crèches collectives, multi-accueil, micro-crèches, haltes-garderies. Returns name, type, category, capacity, address, manager, and (for La Possession) care mode, age range, opening hours, contact info. Useful for parents finding childcare, family-policy mapping.',
    {
      commune: z.enum(['Saint-Denis', 'La Possession']).describe('Commune name. Only "Saint-Denis" and "La Possession" publish this dataset'),
      limit: z.number().int().min(1).max(200).default(50).describe('Max facilities to return (1-200, default 50)'),
    },
    async ({ commune, limit }) => {
      try {
        if (commune === 'Saint-Denis') {
          const data = await client.getRecords<RecordObject>(DATASET_CHILDCARE_SAINT_DENIS, { limit });
          return jsonResult({
            commune,
            total_facilities: data.total_count,
            facilities: data.results.map((row) => ({
              name: pickString(row, ['nom']),
              type: pickString(row, ['type']),
              category: pickString(row, ['categorie']),
              capacity: pickNumber(row, ['capacite']),
              state: pickString(row, ['etat']),
              address: pickString(row, ['adresse']),
              manager: pickString(row, ['gestionnai']),
            })),
          });
        }
        const data = await client.getRecords<RecordObject>(DATASET_CHILDCARE_POSSESSION, { limit });
        return jsonResult({
          commune,
          total_facilities: data.total_count,
          facilities: data.results.map((row) => ({
            name: pickString(row, ['nom_de_l_etablissement']),
            type: pickString(row, ['type_d_etablissement']),
            care_mode: pickString(row, ['mode_d_accueil']),
            capacity: pickNumber(row, ['capacite_d_accueil_et_agrement']),
            age_range: pickString(row, ['tranche_d_age']),
            address: pickString(row, ['adresse']),
            hours: pickString(row, ['horaires_et_jours_de_d_ouverture']),
            phone: pickString(row, ['telephone']),
            email: pickString(row, ['e_mail']),
            website: pickString(row, ['site_web']),
            manager: pickString(row, ['gestionnaire']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to list childcare facilities');
      }
    }
  );
}
