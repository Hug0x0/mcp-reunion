// src/modules/weather.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, pickNumber, pickString, quote } from '../utils/helpers.js';

const DATASET_SYNOP = 'donnees-synop-essentielles-ommpublic';

export function registerWeatherTools(server: McpServer): void {
  server.tool(
    'reunion_get_weather_observations',
    'Get Météo France SYNOP weather observations for Réunion stations (temperature, humidity, wind, pressure, rainfall).',
    {
      station: z.string().optional().describe('Filter by station name (e.g. "LE PORT", "GILLOT-AEROPORT")'),
      from: z.string().optional().describe('ISO date lower bound (e.g. 2024-01-01)'),
      to: z.string().optional().describe('ISO date upper bound'),
      limit: z.number().int().min(1).max(100).default(20).describe('Max records'),
    },
    async ({ station, from, to, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_SYNOP, {
          where: buildWhere([
            `nom_reg = ${quote('La Réunion')}`,
            station ? `nom LIKE ${quote(`${station}%`)}` : undefined,
            from ? `date >= date${quote(from)}` : undefined,
            to ? `date <= date${quote(to)}` : undefined,
          ]),
          order_by: 'date DESC',
          limit,
        });

        return jsonResult({
          total_observations: data.total_count,
          observations: data.results.map((obs) => ({
            station: pickString(obs, ['nom']),
            date: pickString(obs, ['date']),
            commune: pickString(obs, ['libgeo']),
            temperature_c: pickNumber(obs, ['tc']),
            temp_min_12h_c: pickNumber(obs, ['tn12c']),
            temp_max_12h_c: pickNumber(obs, ['tx12c']),
            humidity_pct: pickNumber(obs, ['u']),
            wind_speed_ms: pickNumber(obs, ['ff']),
            wind_direction_deg: pickNumber(obs, ['dd']),
            pressure_sea_level_pa: pickNumber(obs, ['pmer']),
            rainfall_1h_mm: pickNumber(obs, ['rr1']),
            rainfall_24h_mm: pickNumber(obs, ['rr24']),
            present_weather: pickString(obs, ['temps_present']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch weather observations');
      }
    }
  );

  server.tool(
    'reunion_list_weather_stations',
    'List distinct Météo France SYNOP stations located in Réunion.',
    {},
    async () => {
      try {
        const data = await client.getAggregates<RecordObject>(
          DATASET_SYNOP,
          'nom, numer_sta, max(date) as last_observation',
          {
            where: `nom_reg = ${quote('La Réunion')}`,
            groupBy: 'nom, numer_sta',
            orderBy: 'last_observation DESC',
            limit: 50,
          }
        );
        return jsonResult({ total_stations: data.total_count, stations: data.results });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to list weather stations');
      }
    }
  );
}
