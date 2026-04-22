// src/modules/transport.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, pickNumber, pickString, quote } from '../utils/helpers.js';

const DATASET_TRAFFIC = 'trafic-mja-rn-lareunion';
const DATASET_ROAD_CLASS = 'rn-classement-fonctionnel-lareunion';
const DATASET_CYCLE = 'voie-velo-regionale';
const DATASET_GTFS = 'donnees-gtfs-lareunion';
const DATASET_GTFS_ROUTES = 'gtfs-routes-cars-jaunes-lareunion';
const DATASET_ACCIDENTS = 'bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere';
const DATASET_INSPECTION_PRICES = 'prix-des-controles-techniques-a-la-reunion';
const DATASET_DAILY_FLOW = 'debit-journalier-rn-crlaeunion';
const DATASET_SPEED_LIMITS = 'limitations-vitesse-rn-lareunion';

export function registerTransportTools(server: McpServer): void {
  server.tool(
    'reunion_get_road_traffic',
    'Get average daily traffic (TMJA) counts on Réunion national roads.',
    {
      route: z.string().optional().describe('Route code filter, e.g. "RN1", "RN2"'),
      year: z.number().int().optional().describe('Reference year of the count'),
      commune: z.string().optional().describe('Commune filter (prefix match)'),
      limit: z.number().int().min(1).max(500).default(50),
    },
    async ({ route, year, commune, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_TRAFFIC, {
          where: buildWhere([
            route ? `route = ${quote(route)}` : undefined,
            year !== undefined ? `annee = ${year}` : undefined,
            commune ? `commune LIKE ${quote(`${commune}%`)}` : undefined,
          ]),
          order_by: 'annee DESC, tmja DESC',
          limit,
        });

        return jsonResult({
          total_segments: data.total_count,
          segments: data.results.map((row) => ({
            route: pickString(row, ['route']),
            year: pickNumber(row, ['annee']),
            tmja_vehicles_per_day: pickNumber(row, ['tmja']),
            heavy_vehicles_count: pickString(row, ['nb_pl']),
            heavy_vehicles_pct: pickString(row, ['pourcentag']),
            pr_start: pickString(row, ['plod']),
            pr_end: pickString(row, ['plof']),
            lieudit: pickString(row, ['lieudit']),
            commune: pickString(row, ['commune']),
            count_type: pickString(row, ['type_compt']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch road traffic');
      }
    }
  );

  server.tool(
    'reunion_get_road_classification',
    'Get the functional classification of Réunion national road segments (category, class, length).',
    {
      route: z.string().optional().describe('Route code filter'),
      classe: z.string().optional().describe('Class filter'),
      limit: z.number().int().min(1).max(500).default(50),
    },
    async ({ route, classe, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_ROAD_CLASS, {
          where: buildWhere([
            route ? `route = ${quote(route)}` : undefined,
            classe ? `classe = ${quote(classe)}` : undefined,
          ]),
          limit,
        });

        return jsonResult({
          total_segments: data.total_count,
          segments: data.results.map((row) => ({
            route: pickString(row, ['route']),
            category: pickString(row, ['categorie']),
            class: pickString(row, ['classe']),
            description: pickString(row, ['descript']),
            length_m: pickNumber(row, ['longueur']),
            pr_start: pickString(row, ['plod']),
            pr_end: pickString(row, ['plof']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch road classification');
      }
    }
  );

  server.tool(
    'reunion_search_car_jaune_stops',
    'Search Car Jaune (Réunion interurban bus network) GTFS stops by name or code.',
    {
      query: z.string().optional().describe('Free-text search on stop name'),
      stop_code: z.string().optional().describe('Exact stop code filter'),
      wheelchair_accessible: z.boolean().optional().describe('Return only stops flagged wheelchair-accessible (wheelchair_boarding = "1")'),
      limit: z.number().int().min(1).max(500).default(50),
    },
    async ({ query, stop_code, wheelchair_accessible, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_GTFS, {
          where: buildWhere([
            query ? `search(${quote(query)})` : undefined,
            stop_code ? `stop_code = ${quote(stop_code)}` : undefined,
            wheelchair_accessible ? `wheelchair_boarding = ${quote('1')}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_stops: data.total_count,
          stops: data.results.map((row) => ({
            stop_id: pickString(row, ['stop_id']),
            stop_code: pickString(row, ['stop_code']),
            stop_name: pickString(row, ['stop_name']),
            stop_desc: pickString(row, ['stop_desc']),
            zone_id: pickString(row, ['zone_id']),
            location_type: pickString(row, ['location_type']),
            parent_station: pickString(row, ['parent_station']),
            wheelchair_boarding: pickString(row, ['wheelchair_boarding']),
            stop_coordinates: row.stop_coordinates,
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch Car Jaune stops');
      }
    }
  );

  server.tool(
    'reunion_get_cycle_network',
    'Get the Réunion regional cycle network (Voie Vélo Régionale) segments.',
    {
      type: z.string().optional().describe('Amenity type filter'),
      commune: z.string().optional().describe('Micro-region filter (prefix match)'),
      limit: z.number().int().min(1).max(500).default(50),
    },
    async ({ type, commune, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_CYCLE, {
          where: buildWhere([
            type ? `type_amen LIKE ${quote(`${type}%`)}` : undefined,
            commune ? `micro_reg LIKE ${quote(`${commune}%`)}` : undefined,
          ]),
          limit,
        });

        return jsonResult({
          total_segments: data.total_count,
          segments: data.results.map((row) => ({
            type: pickString(row, ['type_amen']),
            identifier: pickString(row, ['identifian']),
            operator: pickString(row, ['exploitant']),
            status: pickString(row, ['etat_amen']),
            commissioning_year: pickNumber(row, ['annee_mis']),
            length_m: pickNumber(row, ['longueur']),
            micro_region: pickString(row, ['micro_reg']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch cycle network');
      }
    }
  );

  server.tool(
    'reunion_list_car_jaune_routes',
    'List Car Jaune bus routes (GTFS) serving La Réunion.',
    {},
    async () => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_GTFS_ROUTES, { limit: 50 });
        return jsonResult({
          total_routes: data.total_count,
          routes: data.results.map((row) => ({
            route_id: pickString(row, ['route_id']),
            short_name: pickString(row, ['route_short_name']),
            long_name: pickString(row, ['route_long_name']),
            route_type: pickString(row, ['route_type']),
            color: pickString(row, ['route_color']),
            url: pickString(row, ['route_url']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to list Car Jaune routes');
      }
    }
  );

  server.tool(
    'reunion_search_road_accidents',
    'Search road-accident records in La Réunion (2016-2019). Filterable by year, severity, commune.',
    {
      year: z.number().int().optional().describe('Year filter (e.g. 2019)'),
      severity: z.number().int().optional().describe('Severity code (1 = unharmed, 2 = killed, 3 = hospitalized, 4 = light)'),
      commune: z.string().optional().describe('Commune name filter (prefix match)'),
      limit: z.number().int().min(1).max(200).default(50),
    },
    async ({ year, severity, commune, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_ACCIDENTS, {
          where: buildWhere([
            year !== undefined ? `an = ${year}` : undefined,
            severity !== undefined ? `grav = ${severity}` : undefined,
            commune ? `nom_com LIKE ${quote(`${commune}%`)}` : undefined,
          ]),
          order_by: 'datetime DESC',
          limit,
        });
        return jsonResult({
          total_accidents: data.total_count,
          accidents: data.results.map((row) => ({
            accident_id: pickString(row, ['num_acc']),
            datetime: pickString(row, ['datetime']),
            commune: pickString(row, ['nom_com']),
            address: pickString(row, ['adr']),
            lat: pickNumber(row, ['lat']),
            lon: pickNumber(row, ['long']),
            severity: pickNumber(row, ['grav']),
            weather: pickString(row, ['atm']),
            luminosity: pickString(row, ['lum']),
            collision_type: pickString(row, ['col']),
            road_category: pickString(row, ['catr']),
            max_speed: pickNumber(row, ['vma']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search accidents');
      }
    }
  );

  server.tool(
    'reunion_search_vehicle_inspection_prices',
    'Search vehicle technical-inspection (contrôle technique) centers and their prices in La Réunion.',
    {
      commune: z.string().optional().describe('Commune filter (prefix match)'),
      vehicle_category: z.string().optional().describe('Vehicle category filter (prefix match)'),
      limit: z.number().int().min(1).max(100).default(50),
    },
    async ({ commune, vehicle_category, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_INSPECTION_PRICES, {
          where: buildWhere([
            commune ? `cct_commune LIKE ${quote(`${commune}%`)}` : undefined,
            vehicle_category ? `cat_vehicule_libelle LIKE ${quote(`${vehicle_category}%`)}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_rows: data.total_count,
          inspections: data.results.map((row) => ({
            center_siret: pickString(row, ['cct_siret']),
            center_name: pickString(row, ['cct_denomination']),
            address: pickString(row, ['cct_adresse']),
            postal_code: pickString(row, ['cct_code_postal']),
            commune: pickString(row, ['cct_commune']),
            phone: pickString(row, ['cct_tel']),
            url: pickString(row, ['cct_url']),
            vehicle_category: pickString(row, ['cat_vehicule_libelle']),
            energy: pickString(row, ['cat_energie_libelle']),
            visit_price: pickNumber(row, ['prix_visite']),
            re_visit_price_min: pickNumber(row, ['prix_contre_visite_mini']),
            re_visit_price_max: pickNumber(row, ['prix_contre_visite_maxi']),
            updated: pickString(row, ['cct_update_date_time']),
            lat: pickNumber(row, ['latitude']),
            lon: pickNumber(row, ['longitude']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch inspection prices');
      }
    }
  );

  server.tool(
    'reunion_get_road_daily_flow',
    'Daily traffic flow measurements on Réunion national-road counting stations.',
    {
      station: z.string().optional().describe('Station code or name (prefix match)'),
      limit: z.number().int().min(1).max(500).default(100),
    },
    async ({ station, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_DAILY_FLOW, {
          where: buildWhere([
            station
              ? `code_station LIKE ${quote(`${station}%`)} OR station LIKE ${quote(`${station}%`)}`
              : undefined,
          ]),
          order_by: 'jour DESC',
          limit,
        });
        return jsonResult({
          total_rows: data.total_count,
          measurements: data.results.map((row) => ({
            station: pickString(row, ['station']),
            station_code: pickString(row, ['code_station']),
            channel: pickString(row, ['libelle_canal']),
            measure_type: pickString(row, ['nature_de_mesure']),
            day: pickString(row, ['jour']),
            value: pickNumber(row, ['mesure']),
            day_type: pickString(row, ['type_jour']),
            holiday: pickString(row, ['vacances']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch daily flow');
      }
    }
  );

  server.tool(
    'reunion_get_speed_limits',
    'Speed limits (vitesse_m in km/h) on Réunion national-road segments.',
    {
      axe: z.string().optional().describe('Road axis filter, e.g. "RN1" (prefix match)'),
      limit: z.number().int().min(1).max(500).default(100),
    },
    async ({ axe, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_SPEED_LIMITS, {
          where: buildWhere([axe ? `axe LIKE ${quote(`${axe}%`)}` : undefined]),
          limit,
        });
        return jsonResult({
          total_segments: data.total_count,
          segments: data.results.map((row) => ({
            objectid: pickNumber(row, ['objectid']),
            road_number: pickString(row, ['numero']),
            axe: pickString(row, ['axe']),
            side: pickString(row, ['cote']),
            speed_kmh: pickNumber(row, ['vitesse_m']),
            length_m: pickNumber(row, ['longueur']),
            start_pr: pickString(row, ['plod']),
            end_pr: pickString(row, ['plof']),
            source: pickString(row, ['source']),
            updated: pickString(row, ['date_modif']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch speed limits');
      }
    }
  );
}
