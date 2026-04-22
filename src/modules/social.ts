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
    'Get the monthly beneficiary counts for Réunion CAF social benefits (RSA, AAH, family allowances, housing, …).',
    {
      benefit_type: z.string().optional().describe('Benefit type filter (prefix match), e.g. "RSA", "AAH"'),
      from: z.string().optional().describe('ISO date lower bound'),
      to: z.string().optional().describe('ISO date upper bound'),
      limit: z.number().int().min(1).max(500).default(50),
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
    'Get monthly total amounts paid out by Réunion CAF for each social benefit type.',
    {
      benefit_type: z.string().optional().describe('Benefit type filter (prefix match)'),
      from: z.string().optional(),
      to: z.string().optional(),
      limit: z.number().int().min(1).max(500).default(50),
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
    'List early-childhood care facilities (crèches, micro-crèches, haltes garderies) in Saint-Denis or La Possession.',
    {
      commune: z.enum(['Saint-Denis', 'La Possession']).describe('Commune (only these two publish this dataset)'),
      limit: z.number().int().min(1).max(200).default(50),
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
