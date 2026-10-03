// src/modules/culture.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { dataGouvClient } from '../clients/data-gouv.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, normalizeText, pickNumber, pickString, quote } from '../utils/helpers.js';

const DATASET_LIBRARIES = 'bibliotheques-publiques';
const RESOURCE_MUSEUMS = '5ccd6238-4fb0-4b2c-b14a-581909489320';
const RESOURCE_JOCONDE = '7e3307c2-f2ff-455c-bbca-bb6f11aec7bb';
const RESOURCE_FESTIVALS = '47ac11c2-8a00-46a7-9fa8-9b802643f975';
const RESOURCE_MUSEUM_ATTENDANCE = '7708e380-e7f8-4b56-936a-5d2a262d852d';

function startsWith(value: string | undefined, prefix: string | undefined): boolean {
  return !prefix || normalizeText(value ?? '').startsWith(normalizeText(prefix));
}

function includes(value: string | undefined, query: string | undefined): boolean {
  return !query || normalizeText(value ?? '').includes(normalizeText(query));
}

function coordinates(value: string | undefined): { lat?: number; lon?: number } {
  if (!value) return {};
  const [lat, lon] = value.split(',').map((part) => Number(part.trim()));
  return {
    lat: Number.isFinite(lat) ? lat : undefined,
    lon: Number.isFinite(lon) ? lon : undefined,
  };
}

export function registerCultureTools(server: McpServer): void {
  server.tool(
    'reunion_list_museums',
    'List museums in La Réunion holding the official "Musée de France" designation (granted by the Ministry of Culture under the 2002 law). This designation guarantees scientific standards, public access, and inalienability of collections. Returns Muséofile ID, official name, commune, full address, postal code, phone, URL, designation decree date, lat/lon. Use reunion_get_museum_attendance for visitor statistics, reunion_search_joconde_collections for artwork records.',
    {},
    async () => {
      try {
        const data = await dataGouvClient.queryAll<RecordObject>(RESOURCE_MUSEUMS, {
          filters: { Departement: 'La Réunion' },
        });
        return jsonResult({
          source: 'data.gouv.fr (Ministère de la Culture)',
          total_museums: data.data.length,
          museums: data.data.map((row) => {
            const position = coordinates(pickString(row, ['Coordonnees']));
            return {
              museofile_id: pickString(row, ['Identifiant']),
              name: pickString(row, ['Nom_officiel']),
              commune: pickString(row, ['Ville']),
              address: pickString(row, ['Adresse']),
              postal_code: pickString(row, ['Code_postal']),
              phone: pickString(row, ['Telephone']),
              url: pickString(row, ['URL']),
              designation_date: pickString(row, ['Date_arrete_attribution_appellation']),
              ...position,
            };
          }),
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
        const data = await dataGouvClient.queryAll<RecordObject>(RESOURCE_JOCONDE, {
          filters: { Departement: 'La Réunion' },
        });
        const rows = data.data.filter((row) => {
          const searchable = [
            pickString(row, ['Titre']),
            pickString(row, ['Auteur']),
            pickString(row, ['Description']),
            pickString(row, ['Denomination']),
          ].filter(Boolean).join(' ');
          return includes(searchable, query)
            && startsWith(pickString(row, ['Nom_officiel_musee']), museum)
            && startsWith(pickString(row, ['Domaine']), domain);
        });
        return jsonResult({
          source: 'data.gouv.fr (Ministère de la Culture)',
          total_items: rows.length,
          items: rows.slice(0, limit).map((row) => ({
            reference: pickString(row, ['Reference']),
            title: pickString(row, ['Titre']),
            author: pickString(row, ['Auteur']),
            domain: pickString(row, ['Domaine']),
            denomination: pickString(row, ['Denomination']),
            materials: pickString(row, ['Materiaux_techniques']),
            period: pickString(row, ['Periode_de_creation']),
            millesime: pickString(row, ['Millesime_de_creation']),
            inventory_number: pickString(row, ['Numero_inventaire']),
            museum: pickString(row, ['Nom_officiel_musee']),
            museofile_code: pickString(row, ['Code_Museofile']),
            description: pickString(row, ['Description']),
            location: pickString(row, ['Localisation']),
            city: pickString(row, ['Ville']),
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
    'List festivals taking place in La Réunion: music, performing arts, cinema/audiovisual, books and literature, visual and digital arts. Returns festival name, territorial scope, host commune, postal code, address, website, email, founding year, main period of occurrence, dominant discipline, sub-categories per discipline (music genre, cinema type, etc.). Source: Ministère de la Culture festival census via data.gouv.fr.',
    {
      discipline: z.string().optional().describe('Dominant discipline prefix match. Examples: "Musique", "Spectacle vivant", "Cinéma", "Livre", "Arts visuels"'),
      commune: z.string().optional().describe('Host commune name prefix match'),
      limit: z.number().int().min(1).max(100).default(50).describe('Max festivals to return (1-100, default 50)'),
    },
    async ({ discipline, commune, limit }) => {
      try {
        const data = await dataGouvClient.queryAll<RecordObject>(RESOURCE_FESTIVALS, {
          contains: { 'Code Insee commune': '974' },
        });
        const rows = data.data.filter((row) =>
          startsWith(pickString(row, ['Discipline dominante']), discipline)
          && startsWith(pickString(row, ['Commune principale de déroulement']), commune)
        );
        return jsonResult({
          source: 'data.gouv.fr (Ministère de la Culture)',
          total_festivals: rows.length,
          festivals: rows.slice(0, limit).map((row) => ({
            name: pickString(row, ['Nom du festival']),
            scope: pickString(row, ['Envergure territoriale']),
            commune: pickString(row, ['Commune principale de déroulement']),
            postal_code: pickString(row, ['Code postal (de la commune principale de déroulement)']),
            address: pickString(row, ['Adresse postale']),
            website: pickString(row, ['Site internet du festival']),
            email: pickString(row, ['Adresse e-mail']),
            created_year: pickNumber(row, ['Année de création du festival']),
            period: pickString(row, ['Période principale de déroulement du festival']),
            discipline: pickString(row, ['Discipline dominante']),
            sub_category_music: pickString(row, ['Sous-catégorie musique']),
            sub_category_cinema: pickString(row, ['Sous-catégorie cinéma et audiovisuel']),
            sub_category_books: pickString(row, ['Sous-catégorie livre et littérature']),
            sub_category_visual_arts: pickString(row, ['Sous-catégorie arts visuels et arts numériques']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to list festivals');
      }
    }
  );

  server.tool(
    'reunion_get_museum_attendance',
    'Annual attendance figures for each Musée de France in La Réunion, broken down by paid vs free admissions. Returns year, museum name, Muséofile reference, city, paid visitors, free visitors and total visitors. Source: Ministère de la Culture / Patrimostat via data.gouv.fr. Sorted by year descending. Useful for cultural-policy evaluation and tourism analysis.',
    {
      year: z.number().int().optional().describe('Year filter (4 digits, e.g. 2022)'),
      museum: z.string().optional().describe('Museum name prefix match (e.g. "Léon Dierx", "Stella Matutina")'),
      limit: z.number().int().min(1).max(500).default(100).describe('Max rows to return (1-500, default 100)'),
    },
    async ({ year, museum, limit }) => {
      try {
        const data = await dataGouvClient.queryAll<RecordObject>(RESOURCE_MUSEUM_ATTENDANCE, {
          filters: { region: 'La Réunion' },
        });
        const rows = data.data
          .filter((row) => (year === undefined || pickNumber(row, ['annee']) === year)
            && startsWith(pickString(row, ['nom_du_musee']), museum))
          .sort((a, b) => (pickNumber(b, ['annee']) ?? 0) - (pickNumber(a, ['annee']) ?? 0));
        return jsonResult({
          source: 'data.gouv.fr (Ministère de la Culture)',
          total_rows: rows.length,
          attendance: rows.slice(0, limit).map((row) => ({
            year: pickNumber(row, ['annee']),
            museum: pickString(row, ['nom_du_musee']),
            museofile_ref: pickString(row, ['IDMuseofile']),
            city: pickString(row, ['ville']),
            paid_visitors: pickNumber(row, ['payant']),
            free_visitors: pickNumber(row, ['gratuit']),
            total_visitors: pickNumber(row, ['total']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch museum attendance');
      }
    }
  );
}
