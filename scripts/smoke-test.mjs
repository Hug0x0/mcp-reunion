#!/usr/bin/env node
// Smoke test for all tools introduced across issues #1–#8.
// Hits data.regionreunion.com directly with the same ODSQL parameters
// our MCP tools emit (default call + a representative filtered call).

const BASE = 'https://data.regionreunion.com/api/explore/v2.1/catalog/datasets';

// Each entry: { pr, tool, dataset, params } where params mirrors what a
// typical tool invocation would build (empty object for "default call").
const TESTS = [
  // --- #19 Geography
  { pr: 19, tool: 'search_ban_addresses', dataset: 'ban-lareunion', params: { limit: 1 } },
  { pr: 19, tool: 'search_ban_addresses (filtered)', dataset: 'ban-lareunion', params: { where: "code_postal = 97400", limit: 1 } },
  { pr: 19, tool: 'search_bal_possession', dataset: 'bal-la-possession', params: { limit: 1 } },
  { pr: 19, tool: 'list_communes', dataset: 'communes-millesime-france', params: { limit: 1 } },
  { pr: 19, tool: 'list_cantons', dataset: 'cantons-millesime-france', params: { limit: 1 } },
  { pr: 19, tool: 'list_epci', dataset: 'intercommunalites-millesime-france', params: { limit: 1 } },
  { pr: 19, tool: 'list_iris', dataset: 'iris-millesime-france', params: { limit: 1 } },
  { pr: 19, tool: 'list_saint_denis_quarters', dataset: 'les-20-quartiers-villesaintdenis', params: { limit: 1 } },

  // --- #20 Environment (new tools only)
  { pr: 20, tool: 'get_waste_tonnage', dataset: 'tonnage-dechets-menagers-et-assimiles-a-la-reunion', params: { order_by: 'annee DESC', limit: 1 } },
  { pr: 20, tool: 'search_rge_companies', dataset: 'liste-des-entreprises-rge-2', params: { limit: 1 } },
  { pr: 20, tool: 'list_znieff', dataset: 'zones-naturelles-d-interet-ecologique-faunistique-et-floristique-a-la-reunion', params: { limit: 1 } },
  { pr: 20, tool: 'list_national_park_perimeters', dataset: 'pnrun_2021', params: { limit: 1 } },
  { pr: 20, tool: 'get_petroleum_consumption', dataset: 'donnees-locales-de-consommation-de-produits-petroliers-a-la-reunion', params: { order_by: 'annee DESC', limit: 1 } },

  // --- #21 Culture
  { pr: 21, tool: 'list_museums', dataset: 'liste-des-musees-de-la-reunion', params: { limit: 1 } },
  { pr: 21, tool: 'search_joconde_collections', dataset: 'base-joconde-extraitculture', params: { limit: 1 } },
  { pr: 21, tool: 'list_libraries', dataset: 'bibliotheques-publiques', params: { limit: 1 } },
  { pr: 21, tool: 'list_festivals', dataset: 'liste-des-festivals-a-la-reunion', params: { limit: 1 } },
  { pr: 21, tool: 'get_museum_attendance', dataset: 'frequentation-des-musees-de-franceculture', params: { order_by: 'annee DESC', limit: 1 } },

  // --- #22 Transport (new tools only)
  { pr: 22, tool: 'list_car_jaune_routes', dataset: 'gtfs-routes-cars-jaunes-lareunion', params: { limit: 1 } },
  { pr: 22, tool: 'search_road_accidents', dataset: 'bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere', params: { order_by: 'datetime DESC', limit: 1 } },
  { pr: 22, tool: 'search_road_accidents (filtered)', dataset: 'bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere', params: { where: 'an = 2019', limit: 1 } },
  { pr: 22, tool: 'search_vehicle_inspection_prices', dataset: 'prix-des-controles-techniques-a-la-reunion', params: { limit: 1 } },
  { pr: 22, tool: 'get_road_daily_flow', dataset: 'debit-journalier-rn-crlaeunion', params: { order_by: 'jour DESC', limit: 1 } },
  { pr: 22, tool: 'get_speed_limits', dataset: 'limitations-vitesse-rn-lareunion', params: { limit: 1 } },

  // --- #23 Territory
  { pr: 23, tool: 'search_real_estate_transactions', dataset: 'demande-de-valeurs-foncierespublic', params: { order_by: 'datemut DESC', limit: 1 } },
  { pr: 23, tool: 'search_real_estate_transactions (filtered)', dataset: 'demande-de-valeurs-foncierespublic', params: { where: "datemut >= date'2022-01-01' AND datemut < date'2023-01-01' AND valeurfonc >= 100000", limit: 1 } },
  { pr: 23, tool: 'get_commune_population', dataset: 'population-francaise-communespublic', params: { order_by: 'annee_recensement DESC, population_totale DESC', limit: 1 } },
  { pr: 23, tool: 'lookup_postal_codes', dataset: 'laposte_hexasmaldatanova', params: { limit: 1 } },
  { pr: 23, tool: 'list_land_potential', dataset: 'potentiel-foncier', params: { order_by: 'surf_rp DESC', limit: 1 } },
  { pr: 23, tool: 'search_residential_permits', dataset: 'liste-des-permis-de-construire-et-autres-autorisations-d-urbanisme-a-la-reunion', params: { order_by: 'date_reelle_autorisation DESC', limit: 1 } },

  // --- #24 Education (new tools only)
  { pr: 24, tool: 'search_schools', dataset: 'adresse-et-geolocalisation-des-etablissements-d-enseignement-du-premier-et-secon', params: { limit: 1 } },
  { pr: 24, tool: 'search_schools (filtered)', dataset: 'adresse-et-geolocalisation-des-etablissements-d-enseignement-du-premier-et-secon', params: { where: "secteur_public_prive_libe = 'Public'", limit: 1 } },
  { pr: 24, tool: 'get_lycee_ips', dataset: 'indices-de-position-sociale-dans-les-lycees-a-la-reunion', params: { limit: 1 } },
  { pr: 24, tool: 'list_priority_education_schools', dataset: 'etablissements-de-l-education-prioritaire-a-la-reunion', params: { limit: 1 } },
  { pr: 24, tool: 'get_higher_education_enrollment', dataset: 'effectifs-d-etudiants-inscrits-dans-les-etablissements-publics-sous-tutelle-du-m', params: { order_by: 'annee DESC, effectif DESC', limit: 1 } },
  { pr: 24, tool: 'search_training_organizations', dataset: 'region-liste-des-organismes-de-formation-et-des-cfa', params: { limit: 1 } },

  // --- #25 Economy
  { pr: 25, tool: 'search_sirene_establishments', dataset: 'base-sirene-v3-lareunion', params: { limit: 1 } },
  { pr: 25, tool: 'search_sirene_establishments (search)', dataset: 'base-sirene-v3-lareunion', params: { where: "search('boulangerie')", limit: 1 } },
  { pr: 25, tool: 'get_consumer_price_index', dataset: 'insee-indices-des-prix-a-la-consommation-a-la-reunion-valeurs-mensuelles', params: { order_by: 'periode DESC', limit: 1 } },
  { pr: 25, tool: 'search_feder_beneficiaries', dataset: 'liste_des_operations_31', params: { order_by: 'date_de_debut_de_l_operation_start_date DESC', limit: 1 } },
  { pr: 25, tool: 'list_coworking_spaces', dataset: 'espace-de-coworkings-sur-l-ile-de-la-reunion', params: { limit: 1 } },
  { pr: 25, tool: 'get_income_poverty_by_iris', dataset: 'revenus-declares-pauvrete-et-niveau-de-vie-en-2015-irispublic', params: { limit: 1 } },

  // --- #26 Administration
  { pr: 26, tool: 'search_admin_directory', dataset: 'annuaire-de-ladministration-base-de-donnees-localespublic', params: { limit: 1 } },
  { pr: 26, tool: 'search_associations', dataset: 'repertoire-local-des-associations-a-la-reunion', params: { order_by: 'creation_date DESC', limit: 1 } },
  { pr: 26, tool: 'search_local_elected_officials', dataset: 'liste-de-l-ensemble-des-elus-locaux', params: { limit: 1 } },
  { pr: 26, tool: 'get_legislative_2022_round1', dataset: 'resultats-des-elections-legislatives-2022-1er-tour-par-bureau-de-vote-a-la-reuni', params: { order_by: 'voix DESC', limit: 1 } },
  { pr: 26, tool: 'list_priority_neighborhoods', dataset: 'quartiers-prioritaires-de-la-politique-de-la-ville-qpv', params: { limit: 1 } },
  { pr: 26, tool: 'search_baby_names', dataset: 'prenomsdpt974depuis2000', params: { order_by: 'nombre DESC', limit: 1 } },
  { pr: 26, tool: 'search_baby_names (filtered)', dataset: 'prenomsdpt974depuis2000', params: { where: "preusuel LIKE 'LEA%' AND annais = '2020'", limit: 1 } },
];

function buildUrl(dataset, params) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    qs.set(k, String(v));
  }
  return `${BASE}/${dataset}/records?${qs.toString()}`;
}

async function run() {
  const results = [];
  for (const t of TESTS) {
    const url = buildUrl(t.dataset, t.params);
    try {
      const res = await fetch(url);
      const body = await res.json();
      if (!res.ok) {
        results.push({ ...t, status: 'FAIL', http: res.status, error: body.message || body.error_key || JSON.stringify(body).slice(0, 200) });
        continue;
      }
      const count = body.total_count;
      const got = body.results?.length ?? 0;
      results.push({ ...t, status: 'OK', total: count, got });
    } catch (err) {
      results.push({ ...t, status: 'FAIL', error: err.message });
    }
  }

  const pad = (s, n) => String(s).padEnd(n);
  console.log('\n' + pad('PR', 5) + pad('STATUS', 7) + pad('TOTAL', 10) + pad('GOT', 5) + 'TOOL  —  ERROR');
  console.log('-'.repeat(100));
  let ok = 0, fail = 0;
  for (const r of results) {
    if (r.status === 'OK') {
      ok++;
      console.log(pad('#' + r.pr, 5) + pad(r.status, 7) + pad(r.total, 10) + pad(r.got, 5) + r.tool);
    } else {
      fail++;
      const errSnippet = (r.error || '').toString().slice(0, 180);
      console.log(pad('#' + r.pr, 5) + pad(r.status, 7) + pad('-', 10) + pad('-', 5) + r.tool + '  —  [' + (r.http || '?') + '] ' + errSnippet);
    }
  }
  console.log('-'.repeat(100));
  console.log(`Totals: ${ok} OK, ${fail} FAIL`);
  process.exitCode = fail === 0 ? 0 : 1;
}

run();
