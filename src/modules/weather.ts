// src/modules/weather.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject, WeatherStation } from '../types.js';
import { errorResult, jsonResult, pickNumber, pickString, quote } from '../utils/helpers.js';

const DATASET_WEATHER_STATIONS = 'reseau-de-stations-meteorologiques-de-meteo-france';
const DATASET_RAIN_STATIONS = 'pluviometrie';

async function datasetExposureNote(datasetId: string): Promise<string | undefined> {
  const metadata = await client.getDatasetMetadata(datasetId);
  if (metadata && metadata.has_records === false) {
    return 'The dataset is currently published as metadata/attachments only and exposes no tabular records through the Explore API.';
  }
  return undefined;
}

export function registerWeatherTools(server: McpServer): void {
  /**
   * Get weather stations
   */
  server.tool(
    'nc_get_weather_stations',
    'Get Météo France weather stations in Réunion',
    {
      commune: z.string().optional().describe('Filter by commune'),
    },
    async ({ commune }) => {
      try {
        const communeField =
          (await client.resolveField(DATASET_WEATHER_STATIONS, ['commune'])) ?? 'commune';

        const data = await client.getRecords<WeatherStation>(DATASET_WEATHER_STATIONS, {
          where: commune ? `${communeField} LIKE ${quote(`${commune}%`)}` : undefined,
          limit: 100,
        });

        return jsonResult({
          total_stations: data.total_count,
          note:
            data.total_count === 0
              ? await datasetExposureNote(DATASET_WEATHER_STATIONS)
              : undefined,
          stations: data.results.map((station) => ({
            name: pickString(station, ['nom_station']),
            commune: pickString(station, ['commune']),
            latitude: pickNumber(station as RecordObject, ['latitude']),
            longitude: pickNumber(station as RecordObject, ['longitude']),
            altitude: pickNumber(station as RecordObject, ['altitude']),
            type: pickString(station, ['type_station']),
          })),
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to fetch weather stations'
        );
      }
    }
  );

  /**
   * Get rain measurement stations
   */
  server.tool(
    'nc_get_rain_stations',
    'Get rain measurement (pluviometry) stations in Réunion',
    {
      commune: z.string().optional().describe('Filter by commune'),
    },
    async ({ commune }) => {
      try {
        const communeField =
          (await client.resolveField(DATASET_RAIN_STATIONS, ['commune'])) ?? 'commune';

        const data = await client.getRecords<RecordObject>(DATASET_RAIN_STATIONS, {
          where: commune ? `${communeField} LIKE ${quote(`${commune}%`)}` : undefined,
          limit: 100,
        });

        return jsonResult({
          total_stations: data.total_count,
          note:
            data.total_count === 0 ? await datasetExposureNote(DATASET_RAIN_STATIONS) : undefined,
          stations: data.results,
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to fetch rain stations'
        );
      }
    }
  );
}
