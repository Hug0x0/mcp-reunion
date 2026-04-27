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
    'Monthly counts of Pôle emploi (now France Travail) jobseekers in La Réunion, broken down by sex and age group. Each row is one month. Returns total, total men, total women, then 6 sub-categories (men/women × <25 / 25-49 / ≥50). Sorted by month descending. Useful for labor-market monitoring, demographic analysis of unemployment, gender-gap studies.',
    {
      from: z.string().optional().describe('Inclusive lower bound on month, ISO format YYYY-MM-DD (use first of month, e.g. "2022-01-01")'),
      to: z.string().optional().describe('Inclusive upper bound on month, ISO format YYYY-MM-DD'),
      limit: z.number().int().min(1).max(500).default(24).describe('Max months to return (1-500, default 24 = 2 years)'),
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
    'Pôle emploi (France Travail) jobseeker counts in La Réunion broken down by commune of residence, per snapshot date. Returns date, commune, INSEE code, postal code, jobseeker count. Sorted by date then jobseekers descending. Combine with reunion_get_commune_population (commune module) to compute unemployment rates per commune. Source: France Travail / Pôle emploi via data.regionreunion.com.',
    {
      commune: z.string().optional().describe('Commune name prefix match (e.g. "Saint-Denis", "Saint-Pierre")'),
      postal_code: z.string().optional().describe('Exact postal code (5 digits, Réunion uses "974xx")'),
      limit: z.number().int().min(1).max(500).default(50).describe('Max records to return (1-500, default 50)'),
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
