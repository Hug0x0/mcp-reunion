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
    'Météo-France SYNOP synoptic weather observations from stations located in La Réunion. SYNOP is the WMO standard for surface observations (every 3 hours typically). Returns: station name, observation timestamp, commune, current temperature (°C), 12h min/max temperature, relative humidity (%), wind speed (m/s) and direction (degrees), sea-level pressure (Pa), 1h and 24h rainfall (mm), present-weather code. Sorted by date descending. Use reunion_list_weather_stations to discover available stations.',
    {
      station: z.string().optional().describe('Station name prefix match (case-sensitive uppercase). Examples: "LE PORT", "GILLOT-AEROPORT" (Saint-Denis airport), "PIERREFONDS" (Saint-Pierre airport), "BELLECOMBE-JACOB"'),
      from: z.string().optional().describe('Inclusive lower bound on date, ISO format YYYY-MM-DD'),
      to: z.string().optional().describe('Inclusive upper bound on date, ISO format YYYY-MM-DD'),
      limit: z.number().int().min(1).max(100).default(20).describe('Max observations to return (1-100, default 20)'),
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
    'List all distinct Météo-France SYNOP synoptic stations active in La Réunion (deduped on station name + WMO number, with last-observation timestamp). Use this first to discover which stations are available before calling reunion_get_weather_observations with a specific station name.',
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
