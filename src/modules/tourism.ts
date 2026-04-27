// src/modules/tourism.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, pickNumber, pickString, quote } from '../utils/helpers.js';

const DATASET_FAMILY_TRAILS = 'sentiers-marmailles-lareunion';
const DATASET_CANYONS = 'bdcanyons-lareunion';
const DATASET_LANDMARKS = 'lieux-remarquables-lareunion-wssoubik';
const DATASET_FREQUENTATION = 'frequentation-touristique-mensuelle-a-la-reunion-depuis-2017';
const DATASET_HIKING = 'circuits-rendonnees-lareunion-wssoubik';
const DATASET_CULTURAL_POIS = 'poles-attractivite-culture-loisirs-lareunion';
const DATASET_COASTAL_TRAIL = 'sentier-littoral-est-lareunion';

export function registerTourismTools(server: McpServer): void {
  server.tool(
    'reunion_list_family_trails',
    'List "sentiers marmailles" — family-friendly walking trails across La Réunion designed for parents with young children. Each trail has manageable length, low elevation gain, and points of interest. Returns trail name, length (km), duration (HH:MM), trail ID. Useful for tourism, family outdoor planning, accessibility studies. Source: ONF / Réunion regional tourism via data.regionreunion.com.',
    {
      limit: z.number().int().min(1).max(200).default(50).describe('Max trails to return (1-200, default 50)'),
    },
    async ({ limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_FAMILY_TRAILS, { limit });
        return jsonResult({
          total_trails: data.total_count,
          trails: data.results.map((row) => ({
            name: pickString(row, ['nom_itiner']),
            length_km: pickNumber(row, ['longueur_k']),
            duration: pickString(row, ['duree_h_mi']),
            id: pickNumber(row, ['id_sentier']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch family trails');
      }
    }
  );

  server.tool(
    'reunion_list_canyons',
    'List practiced canyoning routes in La Réunion (canyons / ravines) — Réunion is one of the world\'s top canyoning destinations thanks to its volcanic relief and waterfalls. Returns canyon name, alternate name, ravine name, sector, approach typology, return typology, frequentation rating, total/descent/approach/return durations (in hours or minutes), forbidden/closed flag, signed length (m). Essential for canyoning planning, safety briefings, professional guides.',
    {
      secteur: z.string().optional().describe('Geographic sector prefix match. Examples: "Cilaos", "Mafate", "Salazie", "Saint-Benoît"'),
      limit: z.number().int().min(1).max(300).default(50).describe('Max canyons to return (1-300, default 50)'),
    },
    async ({ secteur, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_CANYONS, {
          where: buildWhere([secteur ? `secteur LIKE ${quote(`${secteur}%`)}` : undefined]),
          limit,
        });
        return jsonResult({
          total_canyons: data.total_count,
          canyons: data.results.map((row) => ({
            name: pickString(row, ['nom']),
            alt_name: pickString(row, ['nom_2']),
            ravine: pickString(row, ['ravine']),
            sector: pickString(row, ['secteur']),
            typology_approach: pickString(row, ['typologiea']),
            typology_return: pickString(row, ['typologier']),
            frequentation: pickNumber(row, ['frequentat']),
            total_duration_hours: pickNumber(row, ['dureetotal']),
            descent_minutes: pickNumber(row, ['tps_parcou']),
            approach_minutes: pickNumber(row, ['tps_approc']),
            return_minutes: pickNumber(row, ['tps_retour']),
            forbidden: pickString(row, ['interdit']),
            length_m: pickNumber(row, ['long_sig']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch canyons');
      }
    }
  );

  server.tool(
    'reunion_list_hiking_circuits',
    'List the main hiking circuits of La Réunion from the SIT Soubik tourism catalog. Réunion is famous for hiking — the GR R1, GR R2, the cirques (Mafate, Cilaos, Salazie), the Piton de la Fournaise volcano, etc. Returns circuit name, type, hiking-type names, classification, difficulty, distance (km), total duration (minutes), min/max elevation gain (m), min/max altitude (m), zone, open/closed status. Useful for trip planning, route comparison, ONF closures monitoring.',
    {
      difficulty: z.string().optional().describe('Difficulty level prefix match. Examples: "Facile", "Moyen", "Difficile", "Très difficile"'),
      open_only: z.boolean().default(false).describe('If true, return only circuits currently open (is_ouvert = "Oui"). Réunion frequently closes trails after cyclones / heavy rain'),
      limit: z.number().int().min(1).max(200).default(50).describe('Max circuits to return (1-200, default 50)'),
    },
    async ({ difficulty, open_only, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_HIKING, {
          where: buildWhere([
            difficulty ? `difficulte LIKE ${quote(`${difficulty}%`)}` : undefined,
            open_only ? `is_ouvert = ${quote('Oui')}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_circuits: data.total_count,
          circuits: data.results.map((row) => ({
            name: pickString(row, ['nom']),
            type: pickString(row, ['type']),
            hiking_types: pickString(row, ['type_rando_names']),
            classification: pickString(row, ['classification_names']),
            difficulty: pickString(row, ['difficulte']),
            distance_km: pickNumber(row, ['distance_parcourue']),
            total_duration_minutes: pickNumber(row, ['duree_minutes_total']),
            elevation_min_m: pickNumber(row, ['denivele_min']),
            elevation_max_m: pickNumber(row, ['denivele_max']),
            altitude_min_m: pickNumber(row, ['altitude_min']),
            altitude_max_m: pickNumber(row, ['altitude_max']),
            zone: pickString(row, ['zone_translations_item_nom']),
            open: pickString(row, ['is_ouvert']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to list hiking circuits');
      }
    }
  );

  server.tool(
    'reunion_list_cultural_leisure_pois',
    'List Points of Interest (POIs) for culture and leisure in La Réunion, derived from IGN BD TOPO. Covers cinemas, theaters, museums, parks, leisure centers, sport halls, etc. Returns POI ID, toponym, nature (type), origin (data source), importance level. Useful for tourism applications, accessibility/coverage analysis, urban-services mapping.',
    {
      nature: z.string().optional().describe('POI nature prefix match. Examples: "Cinéma", "Théâtre", "Musée", "Parc", "Centre de loisirs", "Salle de spectacle"'),
      limit: z.number().int().min(1).max(300).default(100).describe('Max POIs to return (1-300, default 100)'),
    },
    async ({ nature, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_CULTURAL_POIS, {
          where: buildWhere([nature ? `nature LIKE ${quote(`${nature}%`)}` : undefined]),
          limit,
        });
        return jsonResult({
          total_pois: data.total_count,
          pois: data.results.map((row) => ({
            id: pickString(row, ['id']),
            toponym: pickString(row, ['toponyme']),
            nature: pickString(row, ['nature']),
            origin: pickString(row, ['origine']),
            importance: pickString(row, ['importance']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to list cultural/leisure POIs');
      }
    }
  );

  server.tool(
    'reunion_get_east_coastal_trail',
    'Detailed segments of the East-coast coastal trail (sentier littoral) of La Réunion. Each row is one section/sequence/variant with field-survey attributes: width and length (m), state (good/degraded/closed), surfacing material, vegetation type and density, access conditions, free-text notes. Useful for trail-maintenance planning, accessibility studies, hiking applications.',
    {
      state: z.string().optional().describe('Trail state prefix match. Examples: "Bon", "Dégradé", "Fermé", "Praticable"'),
      limit: z.number().int().min(1).max(100).default(50).describe('Max segments to return (1-100, default 50)'),
    },
    async ({ state, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_COASTAL_TRAIL, {
          where: buildWhere([state ? `etat LIKE ${quote(`${state}%`)}` : undefined]),
          limit,
        });
        return jsonResult({
          total_segments: data.total_count,
          segments: data.results.map((row) => ({
            section: pickString(row, ['troncon']),
            sequence: pickString(row, ['sequence']),
            variant: pickString(row, ['variante']),
            width_m: pickNumber(row, ['largeur']),
            length_m: pickNumber(row, ['longueur']),
            state: pickString(row, ['etat']),
            surfacing: pickString(row, ['revetement']),
            vegetation: pickString(row, ['vegetation']),
            vegetation_density: pickString(row, ['densite']),
            access: pickString(row, ['acces']),
            notes: pickString(row, ['notes']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch coastal trail');
      }
    }
  );

  server.tool(
    'reunion_get_tourism_frequentation',
    'Monthly tourism frequentation in La Réunion since 2017: external (non-resident) tourist arrivals broken down by purpose of stay — affaires (business), affinitaire (visiting family/friends), agrément (leisure), autres (other) — and total spending in EUR. Each row is one month. Sorted by date descending. Source: IRT (Île de La Réunion Tourisme) via data.regionreunion.com. Useful for tourism-policy monitoring, seasonal-trend analysis, economic-impact studies.',
    {
      year: z.string().optional().describe('Year filter, 4 digits (e.g. "2024")'),
      limit: z.number().int().min(1).max(200).default(24).describe('Max months to return (1-200, default 24 = 2 years)'),
    },
    async ({ year, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_FREQUENTATION, {
          where: buildWhere([year ? `annee = ${quote(year)}` : undefined]),
          order_by: 'date DESC',
          limit,
        });
        return jsonResult({
          total_months: data.total_count,
          series: data.results.map((row) => ({
            date: pickString(row, ['date']),
            month: pickString(row, ['mois']),
            year: pickString(row, ['annee']),
            external_tourists: pickNumber(row, ['touristes_exterieurs']),
            business: pickString(row, ['affaires']),
            family: pickNumber(row, ['affinitaire']),
            leisure: pickNumber(row, ['agrement']),
            other: pickNumber(row, ['autres']),
            spending_eur: pickNumber(row, ['depenses_des_touristes_exterieurs']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch tourism frequentation');
      }
    }
  );

  server.tool(
    'reunion_list_landmarks',
    'List remarkable tourism landmarks (lieux remarquables) in La Réunion from the SIT Soubik catalog: scenic viewpoints, waterfalls, beaches, cirque-belvédères, historical sites, etc. Returns landmark name, tagline (accroche), commune, "lieu majeur" flag (highlights), national-park flag, UNESCO World Heritage flag, characteristics, reduced-mobility accessibility. Useful for travel guides, must-see lists, accessibility-aware itineraries.',
    {
      commune: z.string().optional().describe('Commune name prefix match'),
      major_only: z.boolean().default(false).describe('If true, return only landmarks flagged "lieu majeur" (top must-see sites)'),
      limit: z.number().int().min(1).max(200).default(50).describe('Max landmarks to return (1-200, default 50)'),
    },
    async ({ commune, major_only, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_LANDMARKS, {
          where: buildWhere([
            commune ? `commune LIKE ${quote(`${commune}%`)}` : undefined,
            major_only ? 'lieu_majeur = 1' : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_landmarks: data.total_count,
          landmarks: data.results.map((row) => ({
            name: pickString(row, ['nom_du_lieu_remarquable']),
            tagline: pickString(row, ['accroche']),
            commune: pickString(row, ['commune']),
            major: pickNumber(row, ['lieu_majeur']) === 1,
            in_national_park: pickNumber(row, ['situe_dans_un_parc_national']) === 1,
            unesco_world_heritage: pickNumber(row, ['appartient_au_patrimoine_mondial']) === 1,
            characteristics: pickString(row, ['caracteristiques']),
            reduced_mobility_accessible: pickString(row, ['accessible_mobilite_reduite']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch landmarks');
      }
    }
  );
}
