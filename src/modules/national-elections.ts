// src/modules/national-elections.ts
//
// Post-2022 election results that the regional data.regionreunion.com portal
// doesn't carry. Sourced from the Ministry of Interior's France-wide CSVs on
// data.gouv.fr (queried via tabular-api.data.gouv.fr) and filtered server-side
// to département 974.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { dataGouvClient } from '../clients/data-gouv.js';
import { errorResult, jsonResult } from '../utils/helpers.js';

const RES_LEGIS_2024_T1 = '5163f2e3-1362-4c35-89a0-1934bb74f2d9';
const RES_LEGIS_2024_T2 = '41ed46cd-77c2-4ecc-b8eb-374aa953ca39';
const RES_EUROP_2024_DEPT = 'b77cc4da-644f-4323-b6f7-ae6fe9b33f86';

type Row = Record<string, unknown>;

function num(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v.replace(',', '.').replace('%', ''));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function str(v: unknown): string | undefined {
  if (typeof v === 'string') return v.trim() || undefined;
  if (typeof v === 'number') return String(v);
  return undefined;
}

// Melt the wide candidate columns (Nom candidat 1..19, Voix 1..19, etc.) into
// a clean array — skip empty slots so we only return real candidates.
function meltCandidates(row: Row, maxN = 19) {
  const out = [];
  for (let i = 1; i <= maxN; i++) {
    const last = str(row[`Nom candidat ${i}`]);
    if (!last) continue;
    out.push({
      panel: num(row[`Numéro de panneau ${i}`]),
      nuance: str(row[`Nuance candidat ${i}`]),
      last_name: last,
      first_name: str(row[`Prénom candidat ${i}`]),
      sex: str(row[`Sexe candidat ${i}`]),
      votes: num(row[`Voix ${i}`]),
      pct_registered: str(row[`% Voix/inscrits ${i}`]),
      pct_expressed: str(row[`% Voix/exprimés ${i}`]),
      elected: str(row[`Elu ${i}`]),
    });
  }
  return out.sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
}

function meltLists(row: Row, maxN = 38) {
  const out = [];
  for (let i = 1; i <= maxN; i++) {
    const name = str(row[`Libellé de liste ${i}`]);
    if (!name) continue;
    out.push({
      panel: num(row[`Numéro de panneau ${i}`]),
      nuance: str(row[`Nuance liste ${i}`]),
      list_name: name,
      list_short: str(row[`Libellé abrégé de liste ${i}`]),
      votes: num(row[`Voix ${i}`]),
      pct_registered: str(row[`% Voix/inscrits ${i}`]),
      pct_expressed: str(row[`% Voix/exprimés ${i}`]),
      seats: num(row[`Sièges ${i}`]),
    });
  }
  return out.sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
}

function mapBaseStats(row: Row) {
  return {
    registered: num(row.Inscrits),
    voters: num(row.Votants),
    pct_voters: str(row['% Votants']),
    abstentions: num(row.Abstentions),
    pct_abstentions: str(row['% Abstentions']),
    expressed: num(row.Exprimés),
    blank: num(row.Blancs),
    null_votes: num(row.Nuls),
  };
}

async function fetchLegislative2024(resourceId: string, circumscription?: number) {
  const filters: Record<string, string | number | undefined> = {
    'Code département': '974',
  };
  if (circumscription !== undefined) {
    // The CSV stores the full code (974 + 0N), e.g. circo 1 → "97401".
    filters['Code circonscription législative'] = `9740${circumscription}`;
  }
  return dataGouvClient.query<Row>(resourceId, { filters, pageSize: 50 });
}

export function registerNationalElectionsTools(server: McpServer): void {
  server.tool(
    'reunion_get_legislative_2024_round1',
    'Results of the 2024 anticipated legislative elections (élections législatives anticipées, 1st round on June 30, 2024 — called by President Macron after dissolving the Assemblée nationale post-European elections) for La Réunion, aggregated per circonscription (Réunion has 7 circonscriptions). Returns base stats (registered, voters, abstentions, blank, null, expressed votes + percentages) and an array of candidates with panel number, political nuance, last/first name, sex, vote count, % of registered/expressed, elected flag (R1 elections happen rarely). Source: Ministère de l\'Intérieur via data.gouv.fr (queried through tabular-api). For round 2 use reunion_get_legislative_2024_round2.',
    {
      circumscription: z
        .number()
        .int()
        .min(1)
        .max(7)
        .optional()
        .describe('Réunion circonscription number, integer 1 to 7. Omit to return all 7 circonscriptions'),
    },
    async ({ circumscription }) => {
      try {
        const data = await fetchLegislative2024(RES_LEGIS_2024_T1, circumscription);
        return jsonResult({
          source: 'data.gouv.fr (Ministère de l\'Intérieur)',
          round: 1,
          rows: data.data.map((row) => ({
            department: str(row['Libellé département']),
            circumscription_code: str(row['Code circonscription législative']),
            circumscription_name: str(row['Libellé circonscription législative']),
            ...mapBaseStats(row),
            candidates: meltCandidates(row),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch legislative 2024 R1');
      }
    }
  );

  server.tool(
    'reunion_get_legislative_2024_round2',
    'Results of the 2024 anticipated legislative elections, 2nd round (July 7, 2024) in La Réunion, aggregated per circonscription (1-7). Same schema as round 1 but with elected flag populated for the winners (one elected per circonscription, so 7 députés total for Réunion). Returns base voting stats and the candidate-level data with vote count, percentages, and elected flag. Use to identify the deputies who won.',
    {
      circumscription: z
        .number()
        .int()
        .min(1)
        .max(7)
        .optional()
        .describe('Réunion circonscription number, integer 1 to 7. Omit to return all 7 circonscriptions'),
    },
    async ({ circumscription }) => {
      try {
        const data = await fetchLegislative2024(RES_LEGIS_2024_T2, circumscription);
        return jsonResult({
          source: 'data.gouv.fr (Ministère de l\'Intérieur)',
          round: 2,
          rows: data.data.map((row) => ({
            department: str(row['Libellé département']),
            circumscription_code: str(row['Code circonscription législative']),
            circumscription_name: str(row['Libellé circonscription législative']),
            ...mapBaseStats(row),
            candidates: meltCandidates(row),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch legislative 2024 R2');
      }
    }
  );

  server.tool(
    'reunion_get_european_2024',
    'Final results of the European Parliament elections held on June 9, 2024 (single round) aggregated for département 974 (La Réunion). France elects 81 MEPs from a single national constituency, but this dataset shows how Réunion voters behaved as a department. Returns base voting stats (registered, voters, abstentions, blank, null, expressed) and an array of all 38 lists with panel number, political nuance, list name and abbreviated name, vote count, % of registered/expressed, seats won (national-level allocation reflected here). Sorted by vote count descending.',
    {},
    async () => {
      try {
        const data = await dataGouvClient.query<Row>(RES_EUROP_2024_DEPT, {
          filters: { 'Code département': '974' },
          pageSize: 5,
        });
        const row = data.data[0];
        if (!row) {
          return errorResult('No data returned for département 974 in European 2024 dataset');
        }
        return jsonResult({
          source: 'data.gouv.fr (Ministère de l\'Intérieur)',
          election: 'européennes 2024',
          department: str(row['Libellé département']),
          ...mapBaseStats(row),
          lists: meltLists(row),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch European 2024');
      }
    }
  );
}
