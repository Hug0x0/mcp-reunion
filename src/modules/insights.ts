// src/modules/insights.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, pickNumber, pickString, quote } from '../utils/helpers.js';

async function settle<T>(label: string, promise: Promise<T>): Promise<{ label: string; value?: T; error?: string }> {
  try {
    return { label, value: await promise };
  } catch (error) {
    return { label, error: error instanceof Error ? error.message : String(error) };
  }
}

function summarizeCount(result: { total_count?: number } | undefined): number | undefined {
  return typeof result?.total_count === 'number' ? result.total_count : undefined;
}

export function registerInsightTools(server: McpServer): void {
  server.tool(
    'reunion_public_services_profile',
    'Build a multi-dataset public-services profile for a Réunion commune. Combines administration counters, schools, health professionals, public facilities, sport facilities, and childcare data where available. Returns counts plus sample records and inline upstream errors.',
    {
      commune: z.string().min(1).describe('Commune name prefix, e.g. "Saint-Denis", "Saint-Pierre", "La Possession"'),
      limit: z.number().int().min(1).max(20).default(5).describe('Sample records per category'),
    },
    async ({ commune, limit }) => {
      const prefix = `${commune}%`;
      try {
        const [admin, schools, healthPros, facilities, sports] = await Promise.all([
          settle(
            'administration',
            client.getRecords<RecordObject>('annuaire-de-ladministration-base-de-donnees-localespublic', {
              where: `adresse_nomcommune LIKE ${quote(prefix)}`,
              limit,
            })
          ),
          settle(
            'schools',
            client.getRecords<RecordObject>('adresse-et-geolocalisation-des-etablissements-d-enseignement-du-premier-et-secon', {
              where: `libelle_commune LIKE ${quote(prefix)}`,
              limit,
            })
          ),
          settle(
            'health_professionals',
            client.getRecords<RecordObject>('annuaire-des-professionnels-de-santepublic', {
              where: `search(${quote(commune)})`,
              limit,
            })
          ),
          settle(
            'public_facilities',
            client.getRecords<RecordObject>('base-permanente-des-equipements-geolocalisee-la-reunion', {
              where: `com_arm_name LIKE ${quote(prefix)}`,
              limit,
            })
          ),
          settle(
            'sport_facilities',
            client.getRecords<RecordObject>('equipements-sportifs', {
              where: `commune LIKE ${quote(prefix)}`,
              limit,
            })
          ),
        ]);

        return jsonResult({
          commune,
          counts: {
            administration: summarizeCount(admin.value),
            schools: summarizeCount(schools.value),
            health_professionals: summarizeCount(healthPros.value),
            public_facilities: summarizeCount(facilities.value),
            sport_facilities: summarizeCount(sports.value),
          },
          samples: {
            administration: admin.value?.results.map((row) => ({
              name: pickString(row, ['nom']),
              type: pickString(row, ['pivotlocal']),
              address: pickString(row, ['adresse_ligne']),
            })),
            schools: schools.value?.results.map((row) => ({
              name: pickString(row, ['appellation_officielle']),
              type: pickString(row, ['nature_uai_libe']),
              sector: pickString(row, ['secteur_public_prive_libe']),
            })),
            health_professionals: healthPros.value?.results.map((row) => ({
              name: pickString(row, ['nom']),
              profession: pickString(row, ['libelle_profession']),
              phone: pickString(row, ['telephone']),
            })),
            public_facilities: facilities.value?.results.map((row) => ({
              name: pickString(row, ['equipment_name']),
              category: pickString(row, ['category']),
            })),
            sport_facilities: sports.value?.results.map((row) => ({
              installation: pickString(row, ['nom_de_l_installation']),
              equipment: pickString(row, ['nom_de_l_equipement']),
            })),
          },
          upstream_errors: [admin, schools, healthPros, facilities, sports]
            .filter((entry) => entry.error)
            .map((entry) => ({ source: entry.label, error: entry.error })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to build public-services profile');
      }
    }
  );

  server.tool(
    'reunion_tourism_dashboard',
    'Build a compact tourism dashboard for La Réunion from multiple datasets: monthly tourism frequentation, hiking circuits, family trails, classified accommodations, and official museums. Use it for quick tourism snapshots before drilling down into dedicated tourism/hospitality tools.',
    {
      limit: z.number().int().min(1).max(20).default(5).describe('Sample records per category'),
    },
    async ({ limit }) => {
      try {
        const [frequentation, hiking, familyTrails, accommodations, museums] = await Promise.all([
          settle(
            'frequentation',
            client.getRecords<RecordObject>('frequentation-touristique-mensuelle-a-la-reunion-depuis-2017', {
              order_by: 'mois DESC',
              limit,
            })
          ),
          settle(
            'hiking',
            client.getRecords<RecordObject>('circuits-rendonnees-lareunion-wssoubik', { limit })
          ),
          settle(
            'family_trails',
            client.getRecords<RecordObject>('sentiers-marmailles-lareunion', { limit })
          ),
          settle(
            'classified_accommodations',
            client.getRecords<RecordObject>('hebergements-classespublic', {
              order_by: 'date_de_classement DESC',
              limit,
            })
          ),
          settle('museums', client.getRecords<RecordObject>('liste-des-musees-de-la-reunion', { limit })),
        ]);

        return jsonResult({
          counts: {
            tourism_frequentation_rows: summarizeCount(frequentation.value),
            hiking_circuits: summarizeCount(hiking.value),
            family_trails: summarizeCount(familyTrails.value),
            classified_accommodations: summarizeCount(accommodations.value),
            museums: summarizeCount(museums.value),
          },
          latest_frequentation: frequentation.value?.results.map((row) => ({
            month: pickString(row, ['mois']),
            visitors: pickNumber(row, ['nombre_de_touristes', 'touristes']),
            source_market: pickString(row, ['marche', 'pays']),
          })),
          sample_hiking: hiking.value?.results.map((row) => ({
            name: pickString(row, ['nom_itiner', 'nom']),
            difficulty: pickString(row, ['difficulte']),
            duration: pickString(row, ['duree']),
          })),
          sample_family_trails: familyTrails.value?.results.map((row) => ({
            name: pickString(row, ['nom_itiner']),
            length_km: pickNumber(row, ['longueur_k']),
            duration: pickString(row, ['duree_h_mi']),
          })),
          sample_accommodations: accommodations.value?.results.map((row) => ({
            name: pickString(row, ['nom_commercial']),
            typology: pickString(row, ['typologie_etablissement']),
            classification: pickString(row, ['classement']),
            commune: pickString(row, ['commune']),
          })),
          sample_museums: museums.value?.results.map((row) => ({
            name: pickString(row, ['nom_officiel_du_musee']),
            commune: pickString(row, ['commune']),
          })),
          upstream_errors: [frequentation, hiking, familyTrails, accommodations, museums]
            .filter((entry) => entry.error)
            .map((entry) => ({ source: entry.label, error: entry.error })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to build tourism dashboard');
      }
    }
  );
}

