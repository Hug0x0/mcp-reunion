// src/modules/commune.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { errorResult, jsonResult, normalizeText, pickNumber, pickString, quote } from '../utils/helpers.js';

// ODS's search() and LIKE both reject embedded single quotes ("L'Étang-Salé"
// breaks the ODSQL parser even when properly escaped). Strip them and expand
// French place-name abbreviations before sending to the upstream.
function normalizeCommuneQuery(query: string): string {
  return query
    .replace(/[''’]/g, ' ')
    .replace(/\bSt(e?)\b\.?/gi, (_m, e) => `Saint${e ?? ''}`)
    .replace(/\s+/g, ' ')
    .trim();
}

// Each dimension of the profile is fetched in parallel from its source dataset,
// and failures on individual dimensions are reported inline rather than failing
// the whole tool — so the agent always gets a useful picture even if one upstream
// endpoint is slow or 500s.
async function settle<T>(label: string, p: Promise<T>): Promise<{ label: string; value?: T; error?: string }> {
  try {
    return { label, value: await p };
  } catch (error) {
    return { label, error: error instanceof Error ? error.message : String(error) };
  }
}

export function registerCommuneTools(server: McpServer): void {
  server.tool(
    'reunion_commune_profile',
    'Comprehensive snapshot of a Réunion commune (population, QPV, schools, businesses, recent accidents, nearby museums). Combines 7 datasets in parallel.',
    {
      commune: z.string().describe('Commune name (prefix match, case-sensitive, e.g. "Saint-Denis")'),
    },
    async ({ commune }) => {
      const prefix = `${commune}%`;

      const [
        population,
        qpv,
        iris,
        schools,
        priorityEd,
        sirene,
        accidents,
        museums,
      ] = await Promise.all([
        settle(
          'population',
          // Dataset is national — scope to département 974 to avoid matches
          // like "Villiers-Saint-Denis" (Aisne) when user types "Saint-Denis".
          client.getRecords<RecordObject>('population-francaise-communespublic', {
            where: `code_departement = ${quote('974')} AND nom_de_la_commune LIKE ${quote(prefix)}`,
            order_by: 'annee_recensement DESC',
            limit: 1,
          })
        ),
        settle(
          'qpv',
          client.getRecords<RecordObject>('quartiers-prioritaires-de-la-politique-de-la-ville-qpv', {
            where: `commune_qp LIKE ${quote(prefix)}`,
            limit: 50,
          })
        ),
        settle(
          'iris',
          client.getRecords<RecordObject>('iris-millesime-france', {
            where: `com_name LIKE ${quote(prefix)}`,
            limit: 100,
          })
        ),
        settle(
          'schools',
          client.getRecords<RecordObject>(
            'adresse-et-geolocalisation-des-etablissements-d-enseignement-du-premier-et-secon',
            {
              where: `libelle_commune LIKE ${quote(prefix)}`,
              limit: 1,
            }
          )
        ),
        settle(
          'priority_education',
          client.getRecords<RecordObject>('etablissements-de-l-education-prioritaire-a-la-reunion', {
            where: `nom_commune LIKE ${quote(prefix)}`,
            limit: 1,
          })
        ),
        settle(
          'sirene',
          client.getRecords<RecordObject>('base-sirene-v3-lareunion', {
            where: `libellecommuneetablissement LIKE ${quote(prefix)} AND etatadministratifetablissement = ${quote('Actif')}`,
            limit: 1,
          })
        ),
        settle(
          'accidents_2019',
          client.getRecords<RecordObject>(
            'bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere',
            {
              where: `com_name LIKE ${quote(prefix)} AND an = 2019`,
              limit: 1,
            }
          )
        ),
        settle(
          'museums',
          client.getRecords<RecordObject>('liste-des-musees-de-la-reunion', {
            where: `commune LIKE ${quote(prefix)}`,
            limit: 20,
          })
        ),
      ]);

      const populationRow = population.value?.results[0];
      const dimensions = {
        resolved: {
          query: commune,
          matched_commune: populationRow ? pickString(populationRow, ['nom_de_la_commune']) : null,
          insee_code: populationRow ? pickString(populationRow, ['code_insee']) : null,
          epci: populationRow ? pickString(populationRow, ['libepci']) : null,
        },
        population: population.error
          ? { error: population.error }
          : populationRow
            ? {
                census_year: pickNumber(populationRow, ['annee_recensement']),
                total: pickNumber(populationRow, ['population_totale']),
                municipal: pickNumber(populationRow, ['population_municipale']),
                area_km2: pickNumber(populationRow, ['superficie']),
              }
            : null,
        territory: {
          iris_count: iris.error ? null : iris.value?.total_count ?? 0,
          qpv_count: qpv.error ? null : qpv.value?.total_count ?? 0,
          qpv_list: qpv.value?.results.map((row) => ({
            code: pickString(row, ['code_qp']),
            name: pickString(row, ['nom_qp']),
          })) ?? [],
        },
        education: {
          schools_count: schools.error ? null : schools.value?.total_count ?? 0,
          priority_education_schools: priorityEd.error
            ? null
            : priorityEd.value?.total_count ?? 0,
        },
        economy: {
          active_sirene_establishments: sirene.error ? null : sirene.value?.total_count ?? 0,
        },
        safety: {
          accidents_2019: accidents.error ? null : accidents.value?.total_count ?? 0,
        },
        culture: {
          museums_count: museums.error ? null : museums.value?.total_count ?? 0,
          museums: museums.value?.results.map((row) => ({
            name: pickString(row, ['nom_officiel_du_musee']),
            museofile_id: pickString(row, ['identifiant_museofile']),
          })) ?? [],
        },
        errors: [population, qpv, iris, schools, priorityEd, sirene, accidents, museums]
          .filter((r) => r.error)
          .map((r) => ({ dimension: r.label, error: r.error })),
      };

      if (!populationRow && population.error) {
        return errorResult(
          `Commune "${commune}" not found or population dataset unreachable: ${population.error}`
        );
      }

      return jsonResult(dimensions);
    }
  );

  server.tool(
    'reunion_find_commune',
    'Resolve a fuzzy / approximate Réunion commune name or typo to its canonical INSEE code, EPCI, département. Use this to disambiguate user input before calling other tools.',
    {
      query: z.string().describe('Approximate commune name (case- and accent-insensitive)'),
    },
    async ({ query }) => {
      try {
        const cleaned = normalizeCommuneQuery(query);
        let results: RecordObject[] = [];

        if (cleaned) {
          const odsSearch = await client.getRecords<RecordObject>('communes-millesime-france', {
            where: `search(${quote(cleaned)})`,
            order_by: 'year DESC',
            limit: 25,
          });
          results = odsSearch.results;
        }

        // Fallback: pull every Réunion commune (24 rows, cached as a
        // referential dataset) and match client-side on a normalized name.
        // Collapse separators (apostrophes, hyphens, whitespace) so user
        // input like "L Etang-Sale" still matches "L'Étang-Salé".
        const collapse = (s: string) => normalizeText(s).replace(/[''’\-\s]+/g, '');
        if (results.length === 0) {
          const all = await client.getRecords<RecordObject>('communes-millesime-france', {
            limit: 100,
          });
          const needle = collapse(cleaned);
          if (needle) {
            results = all.results.filter((row) => {
              const haystack = collapse(pickString(row, ['com_name']) ?? '');
              return haystack.includes(needle) || needle.includes(haystack);
            });
          }
        }

        // De-duplicate by INSEE code (the dataset has one row per millésime).
        const byInsee = new Map<string, RecordObject>();
        for (const row of results) {
          const code = pickString(row, ['com_code']);
          if (code && !byInsee.has(code)) byInsee.set(code, row);
        }

        return jsonResult({
          query,
          normalized_query: cleaned,
          match_count: byInsee.size,
          matches: Array.from(byInsee.values()).map((row) => ({
            name: pickString(row, ['com_name']),
            insee_code: pickString(row, ['com_code']),
            current_insee_code: pickString(row, ['com_current_code']),
            epci_name: pickString(row, ['epci_name']),
            epci_code: pickString(row, ['epci_code']),
            employment_zone: pickString(row, ['ze2020_name']),
            living_basin: pickString(row, ['bv2022_name']),
            department: pickString(row, ['dep_name']),
            region: pickString(row, ['reg_name']),
            mountain_area: pickNumber(row, ['com_is_mountain_area']),
            year: pickString(row, ['year']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to find commune');
      }
    }
  );
}
