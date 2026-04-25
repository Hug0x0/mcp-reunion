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

  server.tool(
    'reunion_compare_communes',
    'Side-by-side comparison of 2-5 Réunion communes on population, QPV count, active SIRENE establishments, 2019 accidents, and priority-education schools. All dimensions fetched in parallel.',
    {
      communes: z
        .array(z.string())
        .min(2)
        .max(5)
        .describe('2 to 5 commune names (prefix match each)'),
    },
    async ({ communes }) => {
      const fetchOne = async (commune: string) => {
        const prefix = `${commune}%`;
        const [pop, qpv, sirene, accidents, priorityEd] = await Promise.all([
          settle(
            'population',
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
            'priority_ed',
            client.getRecords<RecordObject>('etablissements-de-l-education-prioritaire-a-la-reunion', {
              where: `nom_commune LIKE ${quote(prefix)}`,
              limit: 1,
            })
          ),
        ]);

        const popRow = pop.value?.results[0];
        return {
          query: commune,
          matched: popRow ? pickString(popRow, ['nom_de_la_commune']) : null,
          insee_code: popRow ? pickString(popRow, ['code_insee']) : null,
          population_total: popRow ? pickNumber(popRow, ['population_totale']) : null,
          area_km2: popRow ? pickNumber(popRow, ['superficie']) : null,
          qpv_count: qpv.value?.total_count ?? null,
          active_sirene: sirene.value?.total_count ?? null,
          accidents_2019: accidents.value?.total_count ?? null,
          priority_education_schools: priorityEd.value?.total_count ?? null,
        };
      };

      const rows = await Promise.all(communes.map(fetchOne));
      return jsonResult({ comparison: rows });
    }
  );

  server.tool(
    'reunion_iris_profile',
    'Profile of a single IRIS (fine statistical area used by INSEE): commune membership, income / poverty / inequality indicators (2014 millésime).',
    {
      iris_code: z.string().describe('IRIS code (9 digits, e.g. "974110101")'),
    },
    async ({ iris_code }) => {
      const [meta, income] = await Promise.all([
        settle(
          'meta',
          client.getRecords<RecordObject>('iris-millesime-france', {
            where: `iris_code = ${quote(iris_code)}`,
            order_by: 'year DESC',
            limit: 1,
          })
        ),
        settle(
          'income',
          client.getRecords<RecordObject>('revenus-declares-pauvrete-et-niveau-de-vie-en-2015-irispublic', {
            where: `iris = ${quote(iris_code)}`,
            limit: 1,
          })
        ),
      ]);

      const metaRow = meta.value?.results[0];
      const incomeRow = income.value?.results[0];

      if (!metaRow && meta.error) {
        return errorResult(`IRIS lookup failed: ${meta.error}`);
      }

      return jsonResult({
        iris: metaRow
          ? {
              code: pickString(metaRow, ['iris_code']),
              name: pickString(metaRow, ['iris_name']),
              type: pickString(metaRow, ['iris_type']),
              commune: pickString(metaRow, ['com_name']),
              commune_code: pickString(metaRow, ['com_code']),
              epci: pickString(metaRow, ['epci_name']),
              grand_quartier: pickString(metaRow, ['iris_grd_quart_name']),
              year: pickString(metaRow, ['year']),
            }
          : null,
        income_poverty_2014: income.error
          ? { error: income.error }
          : incomeRow
            ? {
                households_population: pickNumber(incomeRow, ['pop_menages_en_2014_princ']),
                poverty_rate_pct: pickNumber(incomeRow, ['dec_tp6014']),
                median_income: pickNumber(incomeRow, ['dec_med14']),
                q1_income: pickNumber(incomeRow, ['dec_q114']),
                q3_income: pickNumber(incomeRow, ['dec_q314']),
                d1_income: pickNumber(incomeRow, ['dec_d114']),
                d9_income: pickNumber(incomeRow, ['dec_d914']),
                interdecile_ratio: pickNumber(incomeRow, ['dec_rd14']),
                gini: pickNumber(incomeRow, ['dec_gi14']),
                share_wages_pct: pickNumber(incomeRow, ['dec_ptsa14']),
                share_unemployment_pct: pickNumber(incomeRow, ['dec_pcho14']),
                share_benefits_pct: pickNumber(incomeRow, ['dec_pben14']),
                share_pensions_pct: pickNumber(incomeRow, ['dec_ppen14']),
              }
            : null,
      });
    }
  );
}
