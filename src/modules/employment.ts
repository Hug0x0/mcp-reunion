// src/modules/employment.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, pickNumber, pickString, quote } from '../utils/helpers.js';

const DATASET_BY_AGE_SEX = 'demandeurs-d-emploi-inscrits-a-pole-emploi-par-age-et-sexe-a-la-reunion';
const DATASET_BY_COMMUNE = 'demandeurs-d-emploi-inscrits-a-pole-emploi-par-commune-a-la-reunion';

export function registerEmploymentTools(server: McpServer): void {
  server.tool(
    'reunion_get_jobseekers_by_age_sex',
    'Get monthly Pôle emploi jobseeker counts in Réunion broken down by age group and sex.',
    {
      from: z.string().optional().describe('ISO month lower bound, e.g. 2022-01-01'),
      to: z.string().optional().describe('ISO month upper bound'),
      limit: z.number().int().min(1).max(500).default(24).describe('Max months returned'),
    },
    async ({ from, to, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_BY_AGE_SEX, {
          where: buildWhere([
            from ? `mois >= date${quote(from)}` : undefined,
            to ? `mois <= date${quote(to)}` : undefined,
          ]),
          order_by: 'mois DESC',
          limit,
        });

        return jsonResult({
          total_months: data.total_count,
          series: data.results.map((row) => ({
            month: pickString(row, ['mois']),
            total: pickNumber(row, ['total']),
            men_total: pickNumber(row, ['total_hommes']),
            women_total: pickNumber(row, ['total_femmes']),
            men_under_25: pickNumber(row, ['hommes_moins_de_25_ans']),
            men_25_49: pickNumber(row, ['hommes_de_25_a_49_ans']),
            men_50_plus: pickNumber(row, ['hommes_50_ans_ou_plus']),
            women_under_25: pickNumber(row, ['femmes_moins_de_25_ans']),
            women_25_49: pickNumber(row, ['femmes_de_25_a_49_ans']),
            women_50_plus: pickNumber(row, ['femmes_50_ans_ou_plus']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch jobseeker stats');
      }
    }
  );

  server.tool(
    'reunion_get_jobseekers_by_commune',
    'Get Pôle emploi jobseeker counts in Réunion by commune.',
    {
      commune: z.string().optional().describe('Commune name filter (prefix match)'),
      postal_code: z.string().optional().describe('Postal code filter'),
      limit: z.number().int().min(1).max(500).default(50),
    },
    async ({ commune, postal_code, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_BY_COMMUNE, {
          where: buildWhere([
            commune ? `nom_de_la_commune LIKE ${quote(`${commune}%`)}` : undefined,
            postal_code ? `code_postal = ${quote(postal_code)}` : undefined,
          ]),
          order_by: 'date DESC, inscrits DESC',
          limit,
        });

        return jsonResult({
          total_records: data.total_count,
          records: data.results.map((row) => ({
            date: pickString(row, ['date']),
            commune: pickString(row, ['nom_de_la_commune']),
            insee_code: pickString(row, ['code_commune_insee']),
            postal_code: pickString(row, ['code_postal']),
            jobseekers: pickNumber(row, ['inscrits']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch jobseekers by commune');
      }
    }
  );
}
