// src/modules/environment.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, pickNumber, pickString, quote } from '../utils/helpers.js';

const DATASET_AIR_QUALITY = 'world-air-quality-openaq';

export function registerEnvironmentTools(server: McpServer): void {
  server.tool(
    'reunion_get_air_quality',
    'Get air-quality measurements (PM2.5, PM10, NO2, O3, etc.) recorded at Réunion stations via OpenAQ.',
    {
      pollutant: z
        .enum(['pm25', 'pm10', 'no2', 'o3', 'so2', 'co', 'bc'])
        .optional()
        .describe('Pollutant filter (OpenAQ code)'),
      city: z.string().optional().describe('City filter (prefix match)'),
      limit: z.number().int().min(1).max(200).default(50),
    },
    async ({ pollutant, city, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_AIR_QUALITY, {
          where: buildWhere([
            `country = ${quote('FR')}`,
            `country_name_en = ${quote('France')}`,
            `search(${quote('Réunion')}) OR city LIKE ${quote('Saint-%')}`,
            pollutant ? `measurements_parameter = ${quote(pollutant)}` : undefined,
            city ? `city LIKE ${quote(`${city}%`)}` : undefined,
          ]),
          order_by: 'measurements_lastupdated DESC',
          limit,
        });

        return jsonResult({
          total_measurements: data.total_count,
          measurements: data.results.map((row) => ({
            city: pickString(row, ['city']),
            location: pickString(row, ['location']),
            pollutant: pickString(row, ['measurements_parameter']),
            value: pickNumber(row, ['measurements_value']),
            unit: pickString(row, ['measurements_unit']),
            last_updated: pickString(row, ['measurements_lastupdated']),
            source: pickString(row, ['measurements_sourcename']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch air quality');
      }
    }
  );
}
