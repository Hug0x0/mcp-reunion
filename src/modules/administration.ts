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
const DATASET_LEGIS_2022_T2 =
  'resultats-des-elections-legislatives-2022-2nd-tour-par-bureau-de-vote-a-la-reuni';
const DATASET_PRES_2022_T1 =
  'resultats-des-elections-presidentielles-2022-1er-tour-par-bureau-de-vote-a-la-re';
const DATASET_QPV = 'quartiers-prioritaires-de-la-politique-de-la-ville-qpv';
const DATASET_NAMES = 'prenomsdpt974depuis2000';
const DATASET_BOAMP = 'boamp';

// Shared mapper for the per-polling-station election datasets — the 3 results
// datasets (legis R1, legis R2, presidential R1) share the same schema.
function mapBallotRow(row: RecordObject) {
  return {
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
  };
}

export function registerAdministrationTools(server: McpServer): void {
  server.tool(
    'reunion_search_admin_directory',
    'Search the Annuaire de l\'Administration: local counters of public services in La Réunion (town halls / mairies, CCAS, CAF, Pôle emploi, sub-préfectures, tax offices, schools, etc.). Returns name, type (pivotlocal), full address, phone, email, website, opening hours notes, INSEE code, EPCI. Source: Service-Public.fr / DILA via data.regionreunion.com.',
    {
      query: z.string().optional().describe('Free-text search across name, address, services'),
      commune: z.string().optional().describe('Commune name prefix match (e.g. "Saint-Denis")'),
      pivot_local: z.string().optional().describe('Service type prefix match. Examples: "mairie", "ccas", "caf", "pole_emploi", "sous_prefecture", "tresorerie", "ecole", "college", "lycee"'),
      limit: z.number().int().min(1).max(200).default(50).describe('Max counters to return (1-200, default 50)'),
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
    'Search the Répertoire National des Associations (RNA) for La Réunion: registered associations under the 1901 law (sports clubs, cultural orgs, charities, professional unions, etc.). Returns RNA ID (W-prefixed), SIRET, title, object/purpose, social-object categories, dates (creation/declaration/publication/dissolution), nature, full address, website, public-utility flag. Sorted most recent first. Source: Ministère de l\'Intérieur / RNA via data.regionreunion.com.',
    {
      query: z.string().optional().describe('Free-text search across title and object/purpose fields'),
      commune: z.string().optional().describe('Commune name prefix match for the registered address'),
      public: z.boolean().optional().describe('If true, return only associations recognized as "public utility" (reconnues d\'utilité publique)'),
      limit: z.number().int().min(1).max(200).default(50).describe('Max associations to return (1-200, default 50)'),
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
    'Search the registry of local elected officials (élus locaux) for La Réunion: maires, adjoints, conseillers municipaux, conseillers départementaux, conseillers régionaux, présidents/vice-présidents d\'EPCI. Returns first/last name, birth date, exact function, mandate start, function start, socio-professional category (CSP), sex, commune, EPCI, canton. Source: Ministère de l\'Intérieur RNE via data.regionreunion.com.',
    {
      query: z.string().optional().describe('Free-text search across first name, last name, function'),
      commune: z.string().optional().describe('Commune prefix match'),
      function_label: z.string().optional().describe('Function label prefix. Examples: "Maire", "Adjoint au Maire", "Conseiller Municipal", "Conseiller Départemental", "Président d\'EPCI"'),
      limit: z.number().int().min(1).max(500).default(100).describe('Max officials to return (1-500, default 100)'),
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
    'Per polling-station (bureau de vote) results of the June 12, 2022 legislative elections, 1st round, for La Réunion (7 circonscriptions). Each row is one candidate at one polling station, with: commune, INSEE code, circonscription, polling station code/name, registered voters (inscrits), abstentions, voters, blank votes, null votes, expressed votes, candidate panel number, last name, first name, sex, political nuance, votes, vote share of expressed. Sorted by vote count descending. For round 2 use reunion_get_legislative_2022_round2.',
    {
      commune: z.string().optional().describe('Commune name prefix match (e.g. "Saint-Denis")'),
      circumscription: z.string().optional().describe('Circonscription label prefix match (e.g. "1ère circonscription de La Réunion")'),
      polling_station: z.string().optional().describe('Exact polling-station code (bureau de vote), e.g. "0001"'),
      limit: z.number().int().min(1).max(500).default(100).describe('Max rows to return (1-500, default 100)'),
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
    'List Quartiers Prioritaires de la politique de la Ville (QPV) in La Réunion. QPVs are urban areas designated by the State as priority targets for urban policy (eligible for ANRU funding, NPNRU, exonérations fiscales). Returns QPV code, name, hosting commune, INSEE code, EPCI. Source: ANCT (Agence Nationale de la Cohésion des Territoires) via data.regionreunion.com.',
    {
      commune: z.string().optional().describe('Filter by hosting commune name prefix (e.g. "Saint-Denis")'),
      limit: z.number().int().min(1).max(100).default(50).describe('Max QPV to return (1-100, default 50)'),
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
    'Search first names given to babies born in La Réunion (department 974) by year, since 2000. Each row gives: usual first name (uppercase), year of birth, department, sex code, and number of children given that name that year. Sorted by count descending. Source: INSEE Fichier des prénoms via data.regionreunion.com. Useful for naming trend analysis, demographic studies.',
    {
      name: z.string().optional().describe('First name prefix match (case-insensitive — auto-uppercased). Example: "marie" matches "MARIE", "MARIE-CLAIRE", "MARIETTE"'),
      year: z.number().int().optional().describe('Birth year filter (4 digits, 2000-present), e.g. 2020'),
      sex: z.enum(['1', '2']).optional().describe('Sex code: "1" for boys, "2" for girls'),
      limit: z.number().int().min(1).max(500).default(100).describe('Max rows to return (1-500, default 100)'),
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

  server.tool(
    'reunion_get_legislative_2022_round2',
    'Per-polling-station results of the June 19, 2022 legislative elections, 2nd round, for La Réunion. Same schema as round 1 (see reunion_get_legislative_2022_round1): commune, circonscription, bureau de vote, candidate identity and political nuance, registered/voters/blank/null/expressed counts, candidate votes and vote share. Sorted by vote count descending. Useful to identify elected deputies (top vote per circonscription).',
    {
      commune: z.string().optional().describe('Commune name prefix match'),
      circumscription: z.string().optional().describe('Circonscription label prefix match'),
      polling_station: z.string().optional().describe('Exact polling-station (bureau de vote) code'),
      limit: z.number().int().min(1).max(500).default(100).describe('Max rows to return (1-500, default 100)'),
    },
    async ({ commune, circumscription, polling_station, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_LEGIS_2022_T2, {
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
          results: data.results.map(mapBallotRow),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch legislative R2');
      }
    }
  );

  server.tool(
    'reunion_get_presidential_2022_round1',
    'Per-polling-station results of the April 10, 2022 presidential election, 1st round, for La Réunion. 12 candidates ran nationally (Macron, Le Pen, Mélenchon, Zemmour, Pécresse, Jadot, Lassalle, Roussel, Dupont-Aignan, Hidalgo, Poutou, Arthaud). Each row is one candidate at one polling station with vote count and vote share. Schema matches reunion_get_legislative_2022_round1. Sorted by vote count descending.',
    {
      commune: z.string().optional().describe('Commune name prefix match (e.g. "Saint-Denis")'),
      candidate: z.string().optional().describe('Candidate last-name prefix match (case-insensitive — auto-uppercased). Examples: "macron", "le pen", "mélenchon"'),
      polling_station: z.string().optional().describe('Exact polling-station (bureau de vote) code'),
      limit: z.number().int().min(1).max(500).default(100).describe('Max rows to return (1-500, default 100)'),
    },
    async ({ commune, candidate, polling_station, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_PRES_2022_T1, {
          where: buildWhere([
            commune ? `com_name LIKE ${quote(`${commune}%`)}` : undefined,
            candidate ? `nom LIKE ${quote(`${candidate.toUpperCase()}%`)}` : undefined,
            polling_station ? `code_du_b_vote = ${quote(polling_station)}` : undefined,
          ]),
          order_by: 'voix DESC',
          limit,
        });
        return jsonResult({
          total_rows: data.total_count,
          results: data.results.map(mapBallotRow),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch presidential R1');
      }
    }
  );

  server.tool(
    'reunion_search_boamp',
    'Search the BOAMP (Bulletin Officiel des Annonces de Marchés Publics) for public-procurement notices concerning La Réunion: open tenders (appels d\'offres ouverts/restreints), MAPA (procédures adaptées), contract awards (avis d\'attribution), framework agreements (accords-cadres), and concession contracts. Returns notice ID, web ID, object/description, buyer name, awardee (if any), procurement family/nature, procedure type and label, publication date, response deadline, status, official BOAMP URL. Sorted by publication date descending. Source: DILA / BOAMP via data.regionreunion.com.',
    {
      query: z.string().optional().describe('Free-text search across notice object, buyer, awardee, descriptions'),
      buyer: z.string().optional().describe('Buyer / contracting authority name prefix match. Examples: "Région Réunion", "Mairie de Saint-Denis", "CHU"'),
      procedure_type: z.string().optional().describe('Procedure category prefix match. Examples: "Appel d\'offres ouvert", "Procédure adaptée (MAPA)", "Marché négocié"'),
      limit: z.number().int().min(1).max(100).default(25).describe('Max notices to return (1-100, default 25)'),
    },
    async ({ query, buyer, procedure_type, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_BOAMP, {
          where: buildWhere([
            query ? `search(${quote(query)})` : undefined,
            buyer ? `nomacheteur LIKE ${quote(`${buyer}%`)}` : undefined,
            procedure_type ? `procedure_categorise LIKE ${quote(`${procedure_type}%`)}` : undefined,
          ]),
          order_by: 'dateparution DESC',
          limit,
        });
        return jsonResult({
          total_notices: data.total_count,
          notices: data.results.map((row) => ({
            id: pickString(row, ['id']),
            web_id: pickString(row, ['idweb']),
            object: pickString(row, ['objet']),
            buyer: pickString(row, ['nomacheteur']),
            awardee: pickString(row, ['titulaire']),
            family_label: pickString(row, ['famille_libelle']),
            procedure_type: pickString(row, ['type_procedure']),
            procedure_label: pickString(row, ['procedure_libelle']),
            procedure_category: pickString(row, ['procedure_categorise']),
            nature: pickString(row, ['nature_libelle']),
            sub_nature: pickString(row, ['sousnature_libelle']),
            published_at: pickString(row, ['dateparution']),
            response_deadline: pickString(row, ['datelimitereponse']),
            state: pickString(row, ['etat']),
            url: pickString(row, ['url_avis']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search BOAMP');
      }
    }
  );
}
