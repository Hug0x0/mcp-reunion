// scripts/create-dataset-issues.mjs
// One-off: fetch the full data.regionreunion.com catalog, group by theme,
// exclude already-wired datasets, and emit one GitHub issue per theme with
// a checklist of remaining datasets.

import { execFileSync } from 'node:child_process';

const BASE = 'https://data.regionreunion.com/api/explore/v2.1';
const REPO = 'Hug0x0/mcp-reunion';

const COVERED = new Set([
  'donnees-synop-essentielles-ommpublic',
  'demandeurs-d-emploi-inscrits-a-pole-emploi-par-age-et-sexe-a-la-reunion',
  'demandeurs-d-emploi-inscrits-a-pole-emploi-par-commune-a-la-reunion',
  'trafic-mja-rn-lareunion',
  'rn-classement-fonctionnel-lareunion',
  'voie-velo-regionale',
  'donnees-gtfs-lareunion',
  'sentiers-marmailles-lareunion',
  'bdcanyons-lareunion',
  'lieux-remarquables-lareunion-wssoubik',
  'world-air-quality-openaq',
  'base-permanente-des-equipements-geolocalisee-la-reunion',
  'equipements-sportifs',
  'indices-de-position-sociale-dans-les-colleges-a-la-reunion',
  'etablissements-labellises-generation-2024-a-la-reunion',
  'cartographie-des-formations-parcoursup-a-la-reunion',
  'annuaire-des-professionnels-de-santepublic',
  'sites-mobiles-5g-a-la-reunion',
  'arcep_regions',
  'logements-et-logements-sociaux-dans-les-departements-a-la-reunion',
  'couts-et-surfaces-moyens-des-logements-sociaux-a-la-reunion',
  'base-permanente-des-plu-de-la-reunion',
  'liste-des-permis-de-constuire-creant-des-locaux-non-residentiels-a-la-reunion',
  'donnees-essentielles-marches-publics-mairie-de-la-possession',
  'subventions-attribuees-aux-associations-en-2022',
  'subventions-attribuees-aux-associations-en-2023',
]);

async function fetchAll() {
  const all = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const url = `${BASE}/catalog/datasets?limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`catalog fetch ${res.status}`);
    const data = await res.json();
    all.push(...data.results);
    if (data.results.length < pageSize) break;
  }
  return all;
}

function themeOf(ds) {
  const t = ds?.metas?.default?.theme;
  if (Array.isArray(t) && t.length > 0) return t[0];
  return 'Autres';
}

function titleOf(ds) {
  return ds?.metas?.default?.title ?? ds.dataset_id;
}

function slugifyTheme(theme) {
  return theme
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function run(cmd, args) {
  return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'inherit'] }).toString();
}

async function main() {
  console.error('Fetching catalog…');
  const datasets = await fetchAll();
  console.error(`  ${datasets.length} datasets total`);

  const remaining = datasets.filter((d) => !COVERED.has(d.dataset_id));
  console.error(`  ${remaining.length} remaining after excluding ${COVERED.size} covered`);

  const grouped = new Map();
  for (const ds of remaining) {
    const theme = themeOf(ds);
    if (!grouped.has(theme)) grouped.set(theme, []);
    grouped.get(theme).push(ds);
  }

  const sorted = [...grouped.entries()].sort((a, b) => b[1].length - a[1].length);
  console.error(`  ${sorted.length} themes:`);
  for (const [theme, list] of sorted) {
    console.error(`    ${theme}: ${list.length}`);
  }

  if (process.argv.includes('--dry-run')) {
    console.error('\nDry-run — not creating issues. Pass without --dry-run to create.');
    return;
  }

  for (const [theme, list] of sorted) {
    const title = `[module] ${theme} (${list.length} datasets)`;
    const lines = [
      `Tracking issue to wire the **${theme}** datasets from \`data.regionreunion.com\` into a dedicated MCP module.`,
      '',
      '## Suggested workflow per dataset',
      '',
      '1. Inspect schema: `curl https://data.regionreunion.com/api/explore/v2.1/catalog/datasets/<ID>`',
      '2. Pick the interesting fields.',
      '3. Add a tool in the corresponding `src/modules/*.ts` (or create a new module).',
      '4. Bump `TOOL_COUNT` in `src/modules/index.ts` and update README.',
      '',
      `## Datasets (${list.length})`,
      '',
      ...list
        .sort((a, b) => a.dataset_id.localeCompare(b.dataset_id))
        .map((d) => {
          const recs = d?.metas?.default?.records_count ?? '?';
          const url = `https://data.regionreunion.com/explore/dataset/${d.dataset_id}/`;
          return `- [ ] [\`${d.dataset_id}\`](${url}) — ${titleOf(d)} _(${recs} records)_`;
        }),
    ];
    const body = lines.join('\n');

    console.error(`Creating issue: ${title}`);
    const url = run('gh', [
      'issue', 'create',
      '-R', REPO,
      '-t', title,
      '-b', body,
    ]).trim();
    console.error(`  → ${url}`);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
