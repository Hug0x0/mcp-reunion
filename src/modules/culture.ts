// src/modules/culture.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, pickNumber, pickString, quote } from '../utils/helpers.js';

const DATASET_MUSEUMS = 'liste-des-musees-de-la-reunion';
const DATASET_JOCONDE = 'base-joconde-extraitculture';
const DATASET_LIBRARIES = 'bibliotheques-publiques';
const DATASET_FESTIVALS = 'liste-des-festivals-a-la-reunion';
const DATASET_MUSEUM_ATTENDANCE = 'frequentation-des-musees-de-franceculture';

export function registerCultureTools(server: McpServer): void {
  server.tool(
    'reunion_list_museums',
    'List museums in La Réunion holding the official "Musée de France" designation (granted by the Ministry of Culture under the 2002 law). This designation guarantees scientific standards, public access, and inalienability of collections. Returns Muséofile ID, official name, commune, full address, postal code, phone, URL, designation decree date, lat/lon. Use reunion_get_museum_attendance for visitor statistics, reunion_search_joconde_collections for artwork records.',
    {},
    async () => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_MUSEUMS, { limit: 50 });
        return jsonResult({
          total_museums: data.total_count,
          museums: data.results.map((row) => ({
            museofile_id: pickString(row, ['identifiant_museofile']),
            name: pickString(row, ['nom_officiel_du_musee']),
            commune: pickString(row, ['commune']),
            address: pickString(row, ['adresse']),
            postal_code: pickString(row, ['code_postal']),
            phone: pickString(row, ['telephone']),
            url: pickString(row, ['url']),
            designation_date: pickString(row, ['date_arrete_attribution_appellation']),
            lat: pickNumber(row, ['latitude']),
            lon: pickNumber(row, ['longitude']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to list museums');
      }
    }
  );

  server.tool(
    'reunion_search_joconde_collections',
    'Search the Joconde national database extract restricted to La Réunion museum collections. Joconde is the official catalog of artworks and objects held by French museums. Returns reference, title, author, domain (painting, sculpture, photography, ethnography, etc.), denomination, materials/techniques, period and millesime of creation, inventory number, museum, Muséofile code, description, location within museum, city. Useful for cultural research, art history, exhibition curation.',
    {
      query: z.string().optional().describe('Free-text search across title, author, description, denomination'),
      museum: z.string().optional().describe('Museum name prefix match (e.g. "Musée Léon Dierx", "Stella Matutina")'),
      domain: z.string().optional().describe('Domain prefix match. Examples: "peinture", "sculpture", "photographie", "ethnographie", "estampe", "dessin"'),
      limit: z.number().int().min(1).max(100).default(25).describe('Max items to return (1-100, default 25)'),
    },
    async ({ query, museum, domain, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_JOCONDE, {
          where: buildWhere([
            query ? `search(${quote(query)})` : undefined,
            museum ? `nom_officiel_musee LIKE ${quote(`${museum}%`)}` : undefined,
            domain ? `domaine LIKE ${quote(`${domain}%`)}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_items: data.total_count,
          items: data.results.map((row) => ({
            reference: pickString(row, ['reference']),
            title: pickString(row, ['titre']),
            author: pickString(row, ['auteur']),
            domain: pickString(row, ['domaine']),
            denomination: pickString(row, ['denomination']),
            materials: pickString(row, ['materiaux_techniques']),
            period: pickString(row, ['periode_de_creation']),
            millesime: pickString(row, ['millesime_de_creation']),
            inventory_number: pickString(row, ['numero_inventaire']),
            museum: pickString(row, ['nom_officiel_musee']),
            museofile_code: pickString(row, ['code_museofile']),
            description: pickString(row, ['description']),
            location: pickString(row, ['localisation']),
            city: pickString(row, ['ville']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search Joconde');
      }
    }
  );

  server.tool(
    'reunion_list_libraries',
    'List public libraries (bibliothèques publiques: BMVR, médiathèques, BCD, points lecture) in La Réunion. Returns library code, name, sub-name, street address, postal code, commune, INSEE code, statut (municipal / intercommunal), surface in m², opening-hours amplitude, host commune population. Useful for cultural-equipment mapping, accessibility analysis. Source: Ministère de la Culture / Bibliothèques publiques via data.regionreunion.com.',
    {
      commune: z.string().optional().describe('Commune name prefix match (e.g. "Saint-Denis", "Saint-Pierre")'),
      limit: z.number().int().min(1).max(100).default(50).describe('Max libraries to return (1-100, default 50)'),
    },
    async ({ commune, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_LIBRARIES, {
          where: buildWhere([commune ? `ville LIKE ${quote(`${commune}%`)}` : undefined]),
          limit,
        });
        return jsonResult({
          total_libraries: data.total_count,
          libraries: data.results.map((row) => ({
            code: pickString(row, ['code_bib']),
            name: pickString(row, ['libelle1']),
            sub_name: pickString(row, ['libelle2']),
            address: pickString(row, ['voie']),
            postal_code: pickString(row, ['cp']),
            commune: pickString(row, ['ville']),
            insee_code: pickString(row, ['insee']),
            status: pickString(row, ['statut']),
            surface_m2: pickNumber(row, ['surface']),
            opening_hours: pickString(row, ['amplitude_horaire']),
            commune_population: pickNumber(row, ['pop_com']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to list libraries');
      }
    }
  );

  server.tool(
    'reunion_list_festivals',
    'List festivals taking place in La Réunion: music, performing arts, cinema/audiovisual, books and literature, visual and digital arts. Returns festival name, territorial scope, host commune, postal code, address, website, email, founding year, main period of occurrence, dominant discipline, sub-categories per discipline (music genre, cinema type, etc.). Source: Ministère de la Culture festival census via data.regionreunion.com.',
    {
      discipline: z.string().optional().describe('Dominant discipline prefix match. Examples: "Musique", "Spectacle vivant", "Cinéma", "Livre", "Arts visuels"'),
      commune: z.string().optional().describe('Host commune name prefix match'),
      limit: z.number().int().min(1).max(100).default(50).describe('Max festivals to return (1-100, default 50)'),
    },
    async ({ discipline, commune, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_FESTIVALS, {
          where: buildWhere([
            discipline ? `discipline_dominante LIKE ${quote(`${discipline}%`)}` : undefined,
            commune ? `commune_principale_de_deroulement LIKE ${quote(`${commune}%`)}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_festivals: data.total_count,
          festivals: data.results.map((row) => ({
            name: pickString(row, ['nom_du_festival']),
            scope: pickString(row, ['envergure_territoriale']),
            commune: pickString(row, ['commune_principale_de_deroulement']),
            postal_code: pickString(row, ['code_postal_de_la_commune_principale_de_deroulement']),
            address: pickString(row, ['adresse_postale']),
            website: pickString(row, ['site_internet_du_festival']),
            email: pickString(row, ['adresse_e_mail']),
            created_year: pickNumber(row, ['annee_de_creation_du_festival']),
            period: pickString(row, ['periode_principale_de_deroulement_du_festival']),
            discipline: pickString(row, ['discipline_dominante']),
            sub_category_music: pickString(row, ['sous_categorie_musique']),
            sub_category_cinema: pickString(row, ['sous_categorie_cinema_et_audiovisuel']),
            sub_category_books: pickString(row, ['sous_categorie_livre_et_litterature']),
            sub_category_visual_arts: pickString(row, ['sous_categorie_arts_visuels_et_arts_numeriques']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to list festivals');
      }
    }
  );

  server.tool(
    'reunion_get_museum_attendance',
    'Annual attendance figures for each Musée de France in La Réunion, broken down by paid vs free admissions. Returns year, museum name, Muséofile reference, city, paid visitors, free visitors, total visitors, notes, observations. Source: Ministère de la Culture / Patrimostat via data.regionreunion.com. Sorted by year descending. Useful for cultural-policy evaluation, tourism analysis.',
    {
      year: z.number().int().optional().describe('Year filter (4 digits, e.g. 2022)'),
      museum: z.string().optional().describe('Museum name prefix match (e.g. "Léon Dierx", "Stella Matutina")'),
      limit: z.number().int().min(1).max(500).default(100).describe('Max rows to return (1-500, default 100)'),
    },
    async ({ year, museum, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_MUSEUM_ATTENDANCE, {
          where: buildWhere([
            year !== undefined ? `annee = ${year}` : undefined,
            museum ? `nom_du_musee LIKE ${quote(`${museum}%`)}` : undefined,
          ]),
          order_by: 'annee DESC',
          limit,
        });
        return jsonResult({
          total_rows: data.total_count,
          attendance: data.results.map((row) => ({
            year: pickNumber(row, ['annee']),
            museum: pickString(row, ['nom_du_musee']),
            museofile_ref: pickString(row, ['ref_musee']),
            city: pickString(row, ['ville']),
            paid_visitors: pickNumber(row, ['payant']),
            free_visitors: pickNumber(row, ['gratuit']),
            total_visitors: pickNumber(row, ['total']),
            note: pickString(row, ['note']),
            observations: pickString(row, ['observations']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch museum attendance');
      }
    }
  );
}
