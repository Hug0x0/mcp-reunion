// src/modules/employment.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { JobOffer, RecordObject } from '../types.js';
import {
  buildWhere,
  errorResult,
  jsonResult,
  pickNumber,
  pickString,
  quote,
} from '../utils/helpers.js';

const DATASET_JOB_OFFERS = 'offres-d-emploi-deposees-sur-le-site-emploi-nc';
const DATASET_JOB_SEEKERS = 'demandeurs_emploi';
const DATASET_CIVIL_SERVANTS = 'fonctionnaires_nc_communes';
const DATASET_PARTIAL_UNEMPLOYMENT = 'entreprises_chomage_partiel';

export function registerEmploymentTools(server: McpServer): void {
  /**
   * Search job offers
   */
  server.tool(
    'nc_search_job_offers',
    'Search for job offers posted on the official Réunion employment portal',
    {
      query: z.string().optional().describe('Search keywords'),
      commune: z.string().optional().describe('Filter by commune'),
      contract_type: z
        .enum(['CDI', 'CDD', 'Stage', 'Alternance'])
        .optional()
        .describe('Contract type'),
      limit: z.number().int().min(1).max(100).default(20).describe('Max results'),
    },
    async ({ query, commune, contract_type, limit }) => {
      try {
        const [communeField, contractField, publishedField] = await Promise.all([
          client.resolveField(DATASET_JOB_OFFERS, ['ville', 'commune']),
          client.resolveField(DATASET_JOB_OFFERS, ['type_contrat', 'contrat']),
          client.resolveField(DATASET_JOB_OFFERS, ['created_at', 'date_publication']),
        ]);

        const data = await client.getRecords<JobOffer>(DATASET_JOB_OFFERS, {
          where: buildWhere([
            query ? `search(${quote(query)})` : undefined,
            commune && communeField
              ? `${communeField} LIKE ${quote(`${commune}%`)}`
              : undefined,
            contract_type && contractField
              ? `${contractField} = ${quote(contract_type)}`
              : undefined,
          ]),
          order_by: `${publishedField ?? 'created_at'} DESC`,
          limit,
        });

        return jsonResult({
          total_offers: data.total_count,
          job_offers: data.results.map((job) => ({
            reference: pickString(job, ['uuid', 'reference']),
            title: pickString(job, ['titre', 'intitule']) ?? 'Unknown',
            employer:
              pickString(job, ['designation', 'employeur']) ??
              pickString(job, ['enseigne']),
            commune: pickString(job, [communeField ?? 'ville', 'ville', 'commune']),
            contract: pickString(job, [contractField ?? 'type_contrat', 'type_contrat', 'contrat']),
            salary: pickString(job, ['salaire']),
            published: pickString(job, [publishedField ?? 'created_at', 'created_at']),
          })),
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to search job offers'
        );
      }
    }
  );

  /**
   * Get job seeker statistics
   */
  server.tool(
    'nc_get_job_seeker_stats',
    'Get statistics about job seekers in Réunion by various criteria',
    {
      year: z.number().int().min(2004).max(2030).optional().describe('Year to query'),
      province: z
        .enum(['Sud', 'Nord', 'Iles'])
        .optional()
        .describe('Filter by province'),
      group_by: z
        .enum(['province', 'age_class', 'diplome', 'metier_recherche'])
        .default('province')
        .describe('How to group results'),
    },
    async ({ year, province, group_by }) => {
      try {
        const groupFieldMap: Record<string, string | undefined> = {
          province: undefined,
          age_class: undefined,
          diplome: await client.resolveField(DATASET_JOB_SEEKERS, ['niveau', 'diplome']),
          metier_recherche: await client.resolveField(DATASET_JOB_SEEKERS, [
            'code_rome_recherche',
            'metier_recherche',
          ]),
        };

        const yearField =
          (await client.resolveField(DATASET_JOB_SEEKERS, ['annee'])) ?? 'annee';
        const groupField = groupFieldMap[group_by];

        if (!groupField) {
          return jsonResult({
            available: false,
            requested_group_by: group_by,
            message:
              'The currently published dataset does not expose the requested grouping dimension.',
            available_groupings: ['diplome', 'metier_recherche'],
            requested_province: province,
            note:
              province !== undefined
                ? 'Province filtering is not available on the current public dataset schema.'
                : undefined,
          });
        }

        const conditions = buildWhere([
          year !== undefined ? `${yearField} = ${quote(String(year))}` : undefined,
        ]);

        const data = await client.getAggregates<RecordObject>(
          DATASET_JOB_SEEKERS,
          `count(*) as count, ${groupField}`,
          {
            where: conditions,
            groupBy: groupField,
          }
        );

        return jsonResult({
          year,
          province,
          grouped_by: group_by,
          source_field: groupField,
          note:
            province !== undefined
              ? 'Province filtering is not available on the current public dataset schema.'
              : undefined,
          statistics: data.results,
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to fetch job seeker stats'
        );
      }
    }
  );

  /**
   * Get civil servants data
   */
  server.tool(
    'nc_get_civil_servants',
    'Get data about Réunion and municipal civil servants',
    {
      year: z.number().int().min(2013).max(2030).optional().describe('Year'),
      employer_type: z.string().optional().describe('Type of employer'),
      limit: z.number().int().min(1).max(100).default(50).describe('Max results'),
    },
    async ({ year, employer_type, limit }) => {
      try {
        const exists = await client.datasetExists(DATASET_CIVIL_SERVANTS);
        if (!exists) {
          return jsonResult({
            available: false,
            dataset_id: DATASET_CIVIL_SERVANTS,
            message:
              'This dataset is not currently published in the public data.regionreunion.com catalog.',
            requested_filters: {
              year,
              employer_type,
              limit,
            },
          });
        }

        const conditions = buildWhere([
          year !== undefined ? `annee = ${year}` : undefined,
          employer_type ? `type_employeur LIKE ${quote(`${employer_type}%`)}` : undefined,
        ]);

        const data = await client.getRecords<RecordObject>(DATASET_CIVIL_SERVANTS, {
          where: conditions,
          limit,
        });

        return jsonResult({
          total_records: data.total_count,
          civil_servants: data.results,
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to fetch civil servants'
        );
      }
    }
  );

  /**
   * Get partial unemployment data
   */
  server.tool(
    'nc_get_partial_unemployment',
    'Get companies on partial unemployment schemes in Réunion (including special nickel and civil unrest schemes)',
    {
      type: z
        .enum(['droit_commun', 'nickel', 'exactions'])
        .optional()
        .describe('Type of partial unemployment scheme'),
      limit: z.number().int().min(1).max(100).default(50).describe('Max results'),
    },
    async ({ type, limit }) => {
      try {
        const typeField =
          (await client.resolveField(DATASET_PARTIAL_UNEMPLOYMENT, [
            'type_de_chp',
            'type_chomage',
          ])) ?? 'type_de_chp';

        const typePatternMap: Record<string, string> = {
          droit_commun: '%DROIT COMMUN%',
          nickel: '%NICKEL%',
          exactions: '%EXACTION%',
        };

        const data = await client.getRecords<RecordObject>(DATASET_PARTIAL_UNEMPLOYMENT, {
          where: type ? `${typeField} LIKE ${quote(typePatternMap[type])}` : undefined,
          order_by: 'date_debut DESC',
          limit,
        });

        return jsonResult({
          scheme_type: type ?? 'all',
          total_companies: data.total_count,
          companies: data.results.map((company) => ({
            ridet: pickString(company, ['ridet', 'rid7']),
            name: pickString(company, ['raison_sociale', 'denomination']),
            brand: pickString(company, ['enseigne']),
            commune: pickString(company, ['commune', 'libelle_commune']),
            province: pickString(company, ['province']),
            scheme: pickString(company, [typeField, 'type_de_chp']),
            employees: pickNumber(company, ['nb_salaries_concernes', 'nb_salaries']),
            start_date: pickString(company, ['date_debut']),
            end_date: pickString(company, ['date_fin']),
          })),
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to fetch partial unemployment'
        );
      }
    }
  );
}
