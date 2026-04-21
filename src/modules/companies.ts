// src/modules/companies.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { Company, Establishment, RecordObject } from '../types.js';
import {
  buildWhere,
  errorResult,
  jsonResult,
  pickString,
  quote,
} from '../utils/helpers.js';

const DATASET_COMPANIES = 'entreprises-actives-au-ridet';
const DATASET_ESTABLISHMENTS = 'etablissements-actifs-au-ridet';

function normalizeRidet(input: string): string {
  return input.length > 7 ? input.slice(0, 7) : input;
}

export function registerCompanyTools(server: McpServer): void {
  /**
   * Search for companies
   */
  server.tool(
    'nc_search_companies',
    'Search for active companies in Réunion RIDET registry. RIDET is the local business registry equivalent to SIRET in France.',
    {
      query: z.string().min(2).describe('Search term (company name, activity)'),
      commune: z.string().optional().describe('Filter by commune'),
      sector: z.string().optional().describe('Filter by APE/NAF sector code'),
      limit: z.number().int().min(1).max(100).default(20).describe('Max results'),
    },
    async ({ query, commune, sector, limit }) => {
      try {
        const [communeField, activityField] = await Promise.all([
          client.resolveField(DATASET_COMPANIES, ['libelle_commune', 'commune']),
          client.resolveField(DATASET_COMPANIES, ['code_ape', 'ape', 'division_naf']),
        ]);

        const conditions = buildWhere([
          `search(${quote(query)})`,
          commune && communeField
            ? `${communeField} LIKE ${quote(`${commune}%`)}`
            : undefined,
          sector && activityField ? `${activityField} LIKE ${quote(`${sector}%`)}` : undefined,
        ]);

        const data = await client.getRecords<Company>(DATASET_COMPANIES, {
          where: conditions,
          limit,
        });

        return jsonResult({
          query,
          total_found: data.total_count,
          companies: data.results.map((company) => ({
            ridet:
              pickString(company, ['rid7', 'ridet']) ??
              pickString(company, ['ridet', 'rid7']),
            name: pickString(company, ['denomination']) ?? 'Unknown',
            acronym: pickString(company, ['sigle']),
            legal_form:
              pickString(company, ['libelle_formjur', 'forme_juridique']) ??
              pickString(company, ['code_formjur']),
            activity_code:
              pickString(company, ['code_ape', 'ape']) ??
              pickString(company, ['division_naf']),
            activity:
              pickString(company, ['libelle_naf', 'ape_libelle']) ??
              pickString(company, ['libelle_division_naf']),
            commune: pickString(company, ['libelle_commune', 'commune']),
            province: pickString(company, ['province']),
            created: pickString(company, ['date_creation', 'date_entreprises_actives']),
            size: pickString(company, ['effectif_tranche']),
          })),
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to search companies'
        );
      }
    }
  );

  /**
   * Get company details by RIDET number
   */
  server.tool(
    'nc_get_company',
    'Get detailed information about a specific company using its RIDET number',
    {
      ridet: z
        .string()
        .regex(/^\d{6,10}$/)
        .describe('RIDET number (6-10 digits, 7-digit registry number accepted)'),
    },
    async ({ ridet }) => {
      try {
        const normalizedRidet = normalizeRidet(ridet);
        const companyRidetField =
          (await client.resolveField(DATASET_COMPANIES, ['rid7', 'ridet'])) ?? 'rid7';

        const data = await client.getRecords<Company>(DATASET_COMPANIES, {
          where: `${companyRidetField} = ${quote(normalizedRidet)}`,
          limit: 1,
        });

        if (data.total_count === 0) {
          return jsonResult({
            found: false,
            ridet: normalizedRidet,
            message: 'Company not found',
          });
        }

        const company = data.results[0];
        const establishmentRidetField =
          (await client.resolveField(DATASET_ESTABLISHMENTS, ['rid7', 'ridet'])) ?? 'rid7';

        const establishments = await client.getRecords<Establishment>(
          DATASET_ESTABLISHMENTS,
          {
            where: `${establishmentRidetField} = ${quote(normalizedRidet)}`,
            limit: 50,
          }
        );

        return jsonResult({
          found: true,
          company: {
            ridet: pickString(company, ['rid7', 'ridet']),
            name: pickString(company, ['denomination']),
            acronym: pickString(company, ['sigle']),
            legal_form:
              pickString(company, ['libelle_formjur', 'forme_juridique']) ??
              pickString(company, ['code_formjur']),
            activity_code: pickString(company, ['code_ape', 'ape']),
            activity:
              pickString(company, ['libelle_naf', 'ape_libelle']) ??
              pickString(company, ['libelle_division_naf']),
            commune: pickString(company, ['libelle_commune', 'commune']),
            province: pickString(company, ['province']),
            created: pickString(company, ['date_creation', 'date_entreprises_actives']),
            size: pickString(company, ['effectif_tranche']),
          },
          establishments: {
            count: establishments.total_count,
            list: establishments.results.map((establishment) => {
              const nic = pickString(establishment, ['nic', 'ndegetablissement']);
              return {
                nic,
                name:
                  pickString(establishment, ['enseigne']) ??
                  pickString(establishment, ['denomination']),
                address: pickString(establishment, ['adresse']),
                commune: pickString(establishment, ['libelle_commune', 'commune']),
                is_headquarters: nic === '000',
              };
            }),
          },
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to fetch company'
        );
      }
    }
  );

  /**
   * Get companies by sector
   */
  server.tool(
    'nc_get_companies_by_sector',
    'Get all companies in a specific activity sector (APE/NAF code)',
    {
      sector_code: z
        .string()
        .min(2)
        .max(5)
        .describe('APE/NAF sector code (e.g., "07" for mining, "47" for retail)'),
      commune: z.string().optional().describe('Filter by commune'),
      limit: z.number().int().min(1).max(100).default(50).describe('Max results'),
    },
    async ({ sector_code, commune, limit }) => {
      try {
        const [communeField, sectorField] = await Promise.all([
          client.resolveField(DATASET_COMPANIES, ['libelle_commune', 'commune']),
          client.resolveField(DATASET_COMPANIES, ['division_naf', 'code_ape', 'ape']),
        ]);

        const data = await client.getRecords<Company>(DATASET_COMPANIES, {
          where: buildWhere([
            sectorField ? `${sectorField} LIKE ${quote(`${sector_code}%`)}` : undefined,
            commune && communeField
              ? `${communeField} LIKE ${quote(`${commune}%`)}`
              : undefined,
          ]),
          limit,
        });

        return jsonResult({
          sector_code,
          total_companies: data.total_count,
          companies: data.results.map((company) => ({
            ridet: pickString(company, ['rid7', 'ridet']),
            name: pickString(company, ['denomination']),
            activity:
              pickString(company, ['libelle_naf', 'ape_libelle']) ??
              pickString(company, ['libelle_division_naf']),
            commune: pickString(company, ['libelle_commune', 'commune']),
          })),
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to fetch companies by sector'
        );
      }
    }
  );

  /**
   * Get company statistics
   */
  server.tool(
    'nc_get_company_statistics',
    'Get aggregate statistics about companies in Réunion',
    {
      group_by: z
        .enum(['province', 'commune', 'forme_juridique', 'ape'])
        .describe('How to group the statistics'),
    },
    async ({ group_by }) => {
      try {
        const groupFieldMap: Record<string, string | undefined> = {
          province: await client.resolveField(DATASET_COMPANIES, ['province']),
          commune: await client.resolveField(DATASET_COMPANIES, ['libelle_commune', 'commune']),
          forme_juridique: await client.resolveField(DATASET_COMPANIES, [
            'libelle_formjur',
            'forme_juridique',
          ]),
          ape: await client.resolveField(DATASET_COMPANIES, ['division_naf', 'code_ape', 'ape']),
        };

        const groupField = groupFieldMap[group_by];
        if (!groupField) {
          return jsonResult({
            grouped_by: group_by,
            message: 'Requested grouping is not available on the current dataset schema.',
            statistics: [],
          });
        }

        const data = await client.getAggregates<RecordObject>(
          DATASET_COMPANIES,
          `count(*) as count, ${groupField}`,
          { groupBy: groupField }
        );

        return jsonResult({
          grouped_by: group_by,
          source_field: groupField,
          statistics: data.results,
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to fetch statistics'
        );
      }
    }
  );
}
