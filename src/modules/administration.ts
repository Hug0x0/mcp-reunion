// src/modules/administration.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, pickNumber, pickString, quote } from '../utils/helpers.js';

const DATASET_ADMIN_DIR = 'annuaire-de-ladministration-base-de-donnees-localespublic';
const DATASET_ASSOCIATIONS = 'repertoire-local-des-associations-a-la-reunion';
const DATASET_ELUS = 'liste-de-l-ensemble-des-elus-locaux';
const DATASET_LEGIS_2022_T1 =
  'resultats-des-elections-legislatives-2022-1er-tour-par-bureau-de-vote-a-la-reuni';
const DATASET_QPV = 'quartiers-prioritaires-de-la-politique-de-la-ville-qpv';
const DATASET_NAMES = 'prenomsdpt974depuis2000';

export function registerAdministrationTools(server: McpServer): void {
  server.tool(
    'reunion_search_admin_directory',
    'Search public-administration local counters (town halls, social orgs, state services) in La Réunion.',
    {
      query: z.string().optional().describe('Free-text search'),
      commune: z.string().optional().describe('Commune filter (prefix match)'),
      pivot_local: z.string().optional().describe('pivotlocal filter (prefix match, e.g. "mairie")'),
      limit: z.number().int().min(1).max(200).default(50),
    },
    async ({ query, commune, pivot_local, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_ADMIN_DIR, {
          where: buildWhere([
            query ? `search(${quote(query)})` : undefined,
            commune ? `adresse_nomcommune LIKE ${quote(`${commune}%`)}` : undefined,
            pivot_local ? `pivotlocal LIKE ${quote(`${pivot_local}%`)}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_counters: data.total_count,
          counters: data.results.map((row) => ({
            id: pickString(row, ['id']),
            insee_code: pickString(row, ['codeinsee']),
            updated: pickString(row, ['datemiseajour']),
            pivot_local: pickString(row, ['pivotlocal']),
            name: pickString(row, ['nom']),
            address_line: pickString(row, ['adresse_ligne']),
            postal_code: pickString(row, ['adresse_codepostal']),
            commune: pickString(row, ['adresse_nomcommune']),
            email: pickString(row, ['coordonneesnum_email']),
            url: pickString(row, ['coordonneesnum_url']),
            opening_notes: pickString(row, ['ouverture_plagej_note']),
            epci: pickString(row, ['nom_epci']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search admin directory');
      }
    }
  );

  server.tool(
    'reunion_search_associations',
    'Search the RNA local associations registry in La Réunion.',
    {
      query: z.string().optional().describe('Free-text search (title, object)'),
      commune: z.string().optional().describe('Commune filter (prefix match)'),
      public: z.boolean().optional().describe('Return only public-utility associations'),
      limit: z.number().int().min(1).max(200).default(50),
    },
    async ({ query, commune, public: isPublic, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_ASSOCIATIONS, {
          where: buildWhere([
            query ? `search(${quote(query)})` : undefined,
            commune ? `com_name_asso LIKE ${quote(`${commune}%`)}` : undefined,
            isPublic ? `ispublic = ${quote('1')}` : undefined,
          ]),
          order_by: 'creation_date DESC',
          limit,
        });
        return jsonResult({
          total_associations: data.total_count,
          associations: data.results.map((row) => ({
            rna_id: pickString(row, ['id']),
            siret: pickString(row, ['siret']),
            title: pickString(row, ['title']),
            short_title: pickString(row, ['short_title']),
            object: pickString(row, ['object']),
            social_object1: pickString(row, ['social_object1']),
            social_object2: pickString(row, ['social_object2']),
            creation_date: pickString(row, ['creation_date']),
            declaration_date: pickString(row, ['declaration_date']),
            publication_date: pickString(row, ['publication_date']),
            dissolution_date: pickString(row, ['dissolution_date']),
            nature: pickString(row, ['nature']),
            address: pickString(row, ['comp_address_asso']),
            postal_code: pickString(row, ['pc_address_asso']),
            commune: pickString(row, ['com_name_asso']),
            website: pickString(row, ['website']),
            is_public: pickString(row, ['ispublic']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search associations');
      }
    }
  );

  server.tool(
    'reunion_search_local_elected_officials',
    'Search local elected officials in La Réunion (région, département, communes, EPCI).',
    {
      query: z.string().optional().describe('Free-text search on name/function'),
      commune: z.string().optional().describe('Commune filter (prefix match)'),
      function_label: z.string().optional().describe('Function label filter (prefix match on libelle_de_la_fonction)'),
      limit: z.number().int().min(1).max(500).default(100),
    },
    async ({ query, commune, function_label, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_ELUS, {
          where: buildWhere([
            query ? `search(${quote(query)})` : undefined,
            commune ? `com_name LIKE ${quote(`${commune}%`)}` : undefined,
            function_label ? `libelle_de_la_fonction LIKE ${quote(`${function_label}%`)}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_officials: data.total_count,
          officials: data.results.map((row) => ({
            first_name: pickString(row, ['prenom_de_l_elu']),
            last_name: pickString(row, ['nom_de_l_elu']),
            birth_date: pickString(row, ['date_de_naissance']),
            function: pickString(row, ['libelle_de_la_fonction']),
            mandate_start: pickString(row, ['date_de_debut_du_mandat']),
            function_start: pickString(row, ['date_de_debut_de_la_fonction']),
            csp: pickString(row, ['libelle_de_la_categorie_socio_professionnelle']),
            sex: pickString(row, ['code_sexe']),
            commune: pickString(row, ['com_name']),
            epci: pickString(row, ['epci_name']),
            canton: pickString(row, ['libelle_du_canton']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search elected officials');
      }
    }
  );

  server.tool(
    'reunion_get_legislative_2022_round1',
    'Per polling-station results of the 2022 legislative elections (1st round) in La Réunion.',
    {
      commune: z.string().optional().describe('Commune filter (prefix match)'),
      circumscription: z.string().optional().describe('Circonscription label filter (prefix match)'),
      polling_station: z.string().optional().describe('Polling-station code filter (exact)'),
      limit: z.number().int().min(1).max(500).default(100),
    },
    async ({ commune, circumscription, polling_station, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_LEGIS_2022_T1, {
          where: buildWhere([
            commune ? `com_name LIKE ${quote(`${commune}%`)}` : undefined,
            circumscription ? `libelle_de_la_circonscription LIKE ${quote(`${circumscription}%`)}` : undefined,
            polling_station ? `code_du_b_vote = ${quote(polling_station)}` : undefined,
          ]),
          order_by: 'voix DESC',
          limit,
        });
        return jsonResult({
          total_rows: data.total_count,
          results: data.results.map((row) => ({
            commune: pickString(row, ['com_name']),
            commune_code: pickString(row, ['com_code']),
            circumscription: pickString(row, ['libelle_de_la_circonscription']),
            polling_station_code: pickString(row, ['code_du_b_vote']),
            polling_station_name: pickString(row, ['lib_du_b_vote']),
            registered: pickNumber(row, ['inscrits']),
            abstentions: pickNumber(row, ['abstentions']),
            voters: pickNumber(row, ['votants']),
            blank: pickNumber(row, ['blancs']),
            null_votes: pickNumber(row, ['nuls']),
            expressed: pickNumber(row, ['exprimes']),
            panel_num: pickNumber(row, ['ndegpanneau']),
            candidate_last_name: pickString(row, ['nom']),
            candidate_first_name: pickString(row, ['prenom']),
            candidate_sex: pickString(row, ['sexe']),
            political_label: pickString(row, ['nuance']),
            votes: pickNumber(row, ['voix']),
            votes_pct_expressed: pickNumber(row, ['voix_exp']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch legislative results');
      }
    }
  );

  server.tool(
    'reunion_list_priority_neighborhoods',
    'List QPV (Quartiers prioritaires de la politique de la ville) in La Réunion.',
    {
      commune: z.string().optional().describe('Commune filter (prefix match)'),
      limit: z.number().int().min(1).max(100).default(50),
    },
    async ({ commune, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_QPV, {
          where: buildWhere([commune ? `commune_qp LIKE ${quote(`${commune}%`)}` : undefined]),
          limit,
        });
        return jsonResult({
          total_qpv: data.total_count,
          qpv: data.results.map((row) => ({
            code: pickString(row, ['code_qp']),
            name: pickString(row, ['nom_qp']),
            commune: pickString(row, ['commune_qp']),
            insee_code: pickString(row, ['code_insee']),
            epci: pickString(row, ['nom_epci']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to list QPV');
      }
    }
  );

  server.tool(
    'reunion_search_baby_names',
    'Search first names given at birth in La Réunion (974) since 2000.',
    {
      name: z.string().optional().describe('Usual first-name filter (prefix match)'),
      year: z.number().int().optional().describe('Birth year filter'),
      sex: z.enum(['1', '2']).optional().describe('Sex code (1 = boy, 2 = girl)'),
      limit: z.number().int().min(1).max(500).default(100),
    },
    async ({ name, year, sex, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_NAMES, {
          where: buildWhere([
            name ? `preusuel LIKE ${quote(`${name.toUpperCase()}%`)}` : undefined,
            year !== undefined ? `annais = ${quote(String(year))}` : undefined,
            sex ? `sexe = ${quote(sex)}` : undefined,
          ]),
          order_by: 'nombre DESC',
          limit,
        });
        return jsonResult({
          total_rows: data.total_count,
          names: data.results.map((row) => ({
            sex: pickString(row, ['sexe']),
            first_name: pickString(row, ['preusuel']),
            year: pickString(row, ['annais']),
            department: pickString(row, ['dpt']),
            count: pickNumber(row, ['nombre']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search baby names');
      }
    }
  );
}
