// src/modules/nearby.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { jsonResult, pickNumber, pickString } from '../utils/helpers.js';
import { withinRadius } from '../utils/geo.js';

const DATASET_SCHOOLS = 'adresse-et-geolocalisation-des-etablissements-d-enseignement-du-premier-et-secon';
const DATASET_CAR_JAUNE_STOPS = 'donnees-gtfs-lareunion';
const DATASET_MUSEUMS = 'liste-des-musees-de-la-reunion';

const nearbySchema = {
  lat: z.number().min(-22).max(-20).describe('Latitude in decimal degrees, around Réunion (e.g. -20.8877)'),
  lon: z.number().min(55).max(56).describe('Longitude in decimal degrees, around Réunion (e.g. 55.4514)'),
  radius_m: z.number().int().min(50).max(10000).default(1000).describe('Search radius in meters (50-10000, default 1000)'),
  limit: z.number().int().min(1).max(100).default(20).describe('Maximum nearby records to return after distance filtering'),
};

export function registerNearbyTools(server: McpServer): void {
  server.tool(
    'reunion_nearby_schools',
    'Find schools near a latitude/longitude in La Réunion. Uses the geolocated national education directory and returns open primary/secondary establishments sorted by distance.',
    nearbySchema,
    async ({ lat, lon, radius_m, limit }) => {
      const data = await client.getRecords<RecordObject>(DATASET_SCHOOLS, { limit: 500 });
      const schools = data.results.map((row) => ({
        uai: pickString(row, ['numero_uai']),
        name: pickString(row, ['appellation_officielle']),
        type: pickString(row, ['nature_uai_libe']),
        sector: pickString(row, ['secteur_public_prive_libe']),
        address: pickString(row, ['adresse_uai']),
        postal_code: pickString(row, ['code_postal_uai']),
        commune: pickString(row, ['libelle_commune']),
        lat: pickNumber(row, ['latitude']),
        lon: pickNumber(row, ['longitude']),
      }));

      return jsonResult({
        origin: { lat, lon },
        radius_m,
        total_candidates: data.total_count,
        schools: withinRadius(schools, { lat, lon }, radius_m).slice(0, limit),
      });
    }
  );

  server.tool(
    'reunion_nearby_car_jaune_stops',
    'Find Car Jaune bus stops near a latitude/longitude in La Réunion. Uses the static GTFS stops feed and returns stops sorted by distance.',
    nearbySchema,
    async ({ lat, lon, radius_m, limit }) => {
      const data = await client.getRecords<RecordObject>(DATASET_CAR_JAUNE_STOPS, { limit: 1000 });
      const stops = data.results.map((row) => {
        const coordinates = row.stop_coordinates as { lat?: number; lon?: number } | undefined;
        return {
          stop_id: pickString(row, ['stop_id']),
          stop_code: pickString(row, ['stop_code']),
          name: pickString(row, ['stop_name']),
          description: pickString(row, ['stop_desc']),
          wheelchair_boarding: pickString(row, ['wheelchair_boarding']),
          lat: coordinates?.lat,
          lon: coordinates?.lon,
        };
      });

      return jsonResult({
        origin: { lat, lon },
        radius_m,
        total_candidates: data.total_count,
        stops: withinRadius(stops, { lat, lon }, radius_m).slice(0, limit),
      });
    }
  );

  server.tool(
    'reunion_nearby_museums',
    'Find official Musées de France near a latitude/longitude in La Réunion. Returns museums sorted by distance with address and contact fields.',
    nearbySchema,
    async ({ lat, lon, radius_m, limit }) => {
      const data = await client.getRecords<RecordObject>(DATASET_MUSEUMS, { limit: 100 });
      const museums = data.results.map((row) => ({
        museofile_id: pickString(row, ['identifiant_museofile']),
        name: pickString(row, ['nom_officiel_du_musee']),
        commune: pickString(row, ['commune']),
        address: pickString(row, ['adresse']),
        postal_code: pickString(row, ['code_postal']),
        phone: pickString(row, ['telephone']),
        url: pickString(row, ['url']),
        lat: pickNumber(row, ['latitude']),
        lon: pickNumber(row, ['longitude']),
      }));

      return jsonResult({
        origin: { lat, lon },
        radius_m,
        total_candidates: data.total_count,
        museums: withinRadius(museums, { lat, lon }, radius_m).slice(0, limit),
      });
    }
  );
}

