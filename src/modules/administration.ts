// src/modules/administration.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { PublicHoliday, RecordObject } from '../types.js';
import {
  buildWhere,
  daysBetween,
  errorResult,
  jsonResult,
  pickBoolean,
  pickNumber,
  pickString,
  quote,
  today,
} from '../utils/helpers.js';

const DATASET_HOLIDAYS = 'jours-feries-en-nc';
const DATASET_DIGITAL_INDEX = 'data_ifn_nc';

export function registerAdministrationTools(server: McpServer): void {
  /**
   * Get public holidays for a specific year
   */
  server.tool(
    'nc_get_public_holidays',
    'Get all public holidays in Réunion for a specific year. Réunion has unique holidays different from mainland France.',
    {
      year: z
        .number()
        .int()
        .min(2020)
        .max(2030)
        .optional()
        .describe('Year to query (default: current year)'),
    },
    async ({ year }) => {
      try {
        const targetYear = year ?? new Date().getFullYear();
        const [dateField, typeField, sectorField, dayOffField] = await Promise.all([
          client.resolveField(DATASET_HOLIDAYS, ['jour_ferie', 'date_ferie']),
          client.resolveField(DATASET_HOLIDAYS, ['type', 'type_jour']),
          client.resolveField(DATASET_HOLIDAYS, ['zone', 'secteur']),
          client.resolveField(DATASET_HOLIDAYS, ['is_chome', 'jour_chome']),
        ]);

        const safeDateField = dateField ?? 'jour_ferie';

        const data = await client.getRecords<PublicHoliday>(DATASET_HOLIDAYS, {
          where: `${safeDateField} >= '${targetYear}-01-01' AND ${safeDateField} <= '${targetYear}-12-31'`,
          order_by: `${safeDateField} ASC`,
          limit: 100,
        });

        return jsonResult({
          year: targetYear,
          total_holidays: data.total_count,
          holidays: data.results.map((holiday) => {
            const date = pickString(holiday, [safeDateField]);
            return {
              date,
              name: pickString(holiday, ['nom_jour_ferie']) ?? 'Unknown',
              type: pickString(holiday, [typeField ?? 'type', 'type', 'type_jour']),
              sectors: pickString(holiday, [sectorField ?? 'zone', 'zone', 'secteur']),
              day_off:
                pickBoolean(holiday, [dayOffField ?? 'is_chome', 'is_chome', 'jour_chome']) ??
                false,
            };
          }),
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to fetch holidays'
        );
      }
    }
  );

  /**
   * Check if a specific date is a public holiday
   */
  server.tool(
    'nc_is_public_holiday',
    'Check if a specific date is a public holiday in Réunion',
    {
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .describe('Date to check in YYYY-MM-DD format'),
    },
    async ({ date }) => {
      try {
        const dateField =
          (await client.resolveField(DATASET_HOLIDAYS, ['jour_ferie', 'date_ferie'])) ??
          'jour_ferie';

        const data = await client.getRecords<PublicHoliday>(DATASET_HOLIDAYS, {
          where: `${dateField} = '${date}'`,
          limit: 1,
        });

        const isHoliday = data.total_count > 0;
        const holiday = data.results[0];

        return jsonResult({
          date,
          is_public_holiday: isHoliday,
          ...(isHoliday &&
            holiday && {
              holiday_name: pickString(holiday, ['nom_jour_ferie']),
              type: pickString(holiday, ['type', 'type_jour']),
              sectors: pickString(holiday, ['zone', 'secteur']),
            }),
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to check date'
        );
      }
    }
  );

  /**
   * Get upcoming public holidays
   */
  server.tool(
    'nc_get_upcoming_holidays',
    'Get the next upcoming public holidays in Réunion from today',
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(5)
        .describe('Number of upcoming holidays to return (default: 5)'),
    },
    async ({ limit }) => {
      try {
        const todayDate = today();
        const dateField =
          (await client.resolveField(DATASET_HOLIDAYS, ['jour_ferie', 'date_ferie'])) ??
          'jour_ferie';

        const data = await client.getRecords<PublicHoliday>(DATASET_HOLIDAYS, {
          where: `${dateField} >= '${todayDate}'`,
          order_by: `${dateField} ASC`,
          limit,
        });

        return jsonResult({
          from_date: todayDate,
          upcoming_holidays: data.results.map((holiday) => {
            const holidayDate = pickString(holiday, [dateField]) ?? todayDate;
            return {
              date: holidayDate,
              name: pickString(holiday, ['nom_jour_ferie']) ?? 'Unknown',
              days_until: daysBetween(todayDate, holidayDate),
              type: pickString(holiday, ['type', 'type_jour']),
            };
          }),
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to fetch upcoming holidays'
        );
      }
    }
  );

  /**
   * Get digital fragility index by commune
   */
  server.tool(
    'nc_get_digital_fragility_index',
    'Get the digital fragility index for communes in Réunion. Higher score means higher risk of digital exclusion.',
    {
      commune: z.string().optional().describe('Filter by commune name'),
      province: z
        .enum(['Sud', 'Nord', 'Iles'])
        .optional()
        .describe('Filter by province'),
    },
    async ({ commune, province }) => {
      try {
        const [communeField, provinceField, scoreField, contextualizedScoreField] =
          await Promise.all([
            client.resolveField(DATASET_DIGITAL_INDEX, ['nom_com', 'commune']),
            client.resolveField(DATASET_DIGITAL_INDEX, ['province']),
            client.resolveField(DATASET_DIGITAL_INDEX, ['ifn_contextualise', 'score_global']),
            client.resolveField(DATASET_DIGITAL_INDEX, ['ifn', 'score_global']),
          ]);

        const conditions = buildWhere([
          commune && communeField
            ? `${communeField} LIKE ${quote(`${commune}%`)}`
            : undefined,
          province && provinceField
            ? `${provinceField} LIKE ${quote(`%${province}%`)}`
            : undefined,
        ]);

        const data = await client.getRecords<RecordObject>(DATASET_DIGITAL_INDEX, {
          where: conditions,
          order_by: `${scoreField ?? 'ifn_contextualise'} DESC`,
          limit: 50,
        });

        return jsonResult({
          total_communes: data.total_count,
          results: data.results.map((row) => ({
            commune: pickString(row, [communeField ?? 'nom_com', 'nom_com', 'commune']),
            province: pickString(row, [provinceField ?? 'province', 'province']),
            score: pickNumber(row, [scoreField ?? 'ifn_contextualise', 'ifn_contextualise']),
            raw_ifn: pickNumber(row, [contextualizedScoreField ?? 'ifn', 'ifn']),
            population: pickNumber(row, ['population_legale']),
            density: pickNumber(row, ['densite']),
          })),
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to fetch digital index'
        );
      }
    }
  );
}
