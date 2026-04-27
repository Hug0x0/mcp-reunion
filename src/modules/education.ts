// src/modules/education.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, pickNumber, pickString, quote } from '../utils/helpers.js';

const DATASET_IPS_COLLEGES = 'indices-de-position-sociale-dans-les-colleges-a-la-reunion';
const DATASET_G2024 = 'etablissements-labellises-generation-2024-a-la-reunion';
const DATASET_PARCOURSUP = 'cartographie-des-formations-parcoursup-a-la-reunion';
const DATASET_SCHOOLS_GEO = 'adresse-et-geolocalisation-des-etablissements-d-enseignement-du-premier-et-secon';
const DATASET_IPS_LYCEES = 'indices-de-position-sociale-dans-les-lycees-a-la-reunion';
const DATASET_PRIORITY_EDUCATION = 'etablissements-de-l-education-prioritaire-a-la-reunion';
const DATASET_HIGHER_ED_STUDENTS = 'effectifs-d-etudiants-inscrits-dans-les-etablissements-publics-sous-tutelle-du-m';
const DATASET_TRAINING_ORGS = 'region-liste-des-organismes-de-formation-et-des-cfa';

export function registerEducationTools(server: McpServer): void {
  server.tool(
    'reunion_get_college_ips',
    'DEPP Indice de Position Sociale (IPS) of middle schools (collèges) in La Réunion. IPS is a 50-200 score that summarizes the average socio-professional category of pupils\' parents (higher = more privileged students). It is the standard tool to assess school social mix and educational inequality. Returns school name, UAI ID, commune, sector (Public/Privé sous contrat), school year, IPS value, IPS standard deviation. Sorted IPS descending.',
    {
      commune: z.string().optional().describe('Commune name prefix match'),
      sector: z.enum(['Public', 'Privé sous contrat']).optional().describe('School sector: "Public" (public) or "Privé sous contrat" (subsidized private)'),
      rentree: z.string().optional().describe('School year (rentrée), format YYYY-YYYY. Examples: "2021-2022", "2022-2023"'),
      limit: z.number().int().min(1).max(500).default(100).describe('Max schools to return (1-500, default 100)'),
    },
    async ({ commune, sector, rentree, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_IPS_COLLEGES, {
          where: buildWhere([
            commune ? `nom_de_la_commune LIKE ${quote(`${commune}%`)}` : undefined,
            sector ? `secteur = ${quote(sector)}` : undefined,
            rentree ? `rentree_scolaire = ${quote(rentree)}` : undefined,
          ]),
          order_by: 'ips DESC',
          limit,
        });
        return jsonResult({
          total_schools: data.total_count,
          schools: data.results.map((row) => ({
            school: pickString(row, ['nom_de_l_etablissment']),
            uai: pickString(row, ['uai']),
            commune: pickString(row, ['nom_de_la_commune']),
            sector: pickString(row, ['secteur']),
            rentree: pickString(row, ['rentree_scolaire']),
            ips: pickNumber(row, ['ips']),
            ips_stddev: pickNumber(row, ['ecart_type_de_l_ips']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch college IPS');
      }
    }
  );

  server.tool(
    'reunion_list_gen2024_schools',
    'List schools in La Réunion that received the "Génération 2024" label — a Ministry of Education + Sport designation tied to the Paris 2024 Olympics, awarded to schools that develop sport-oriented projects (extra hours, partnerships with clubs, Olympic Day events). Returns school name, UAI, type (école/collège/lycée), sector, commune, total enrollment, priority-zone status, ULIS/SEGPA/sport-section flags, lycée-des-métiers flag.',
    {
      commune: z.string().optional().describe('Commune name prefix match'),
      type: z.string().optional().describe('Establishment type prefix match. Examples: "Ecole", "Collège", "Lycée"'),
      limit: z.number().int().min(1).max(300).default(100).describe('Max schools to return (1-300, default 100)'),
    },
    async ({ commune, type, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_G2024, {
          where: buildWhere([
            commune ? `commune LIKE ${quote(`${commune}%`)}` : undefined,
            type ? `type LIKE ${quote(`${type}%`)}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_schools: data.total_count,
          schools: data.results.map((row) => ({
            name: pickString(row, ['nom_etablissement']),
            uai: pickString(row, ['uai']),
            type: pickString(row, ['type']),
            sector: pickString(row, ['statut_public_prive']),
            commune: pickString(row, ['commune']),
            enrollment: pickNumber(row, ['effectif']),
            priority_zone: pickString(row, ['educ_prio']),
            has_ulis: pickNumber(row, ['ulis']) === 1,
            has_segpa: pickNumber(row, ['segpa']) === 1,
            has_sport_section: pickNumber(row, ['section_sport']) === 1,
            is_lycee_des_metiers: pickNumber(row, ['lycee_des_metiers']) === 1,
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch G2024 schools');
      }
    }
  );

  server.tool(
    'reunion_search_parcoursup_formations',
    'Search post-baccalaureate higher-education programs available via Parcoursup (the national university admissions platform) in La Réunion. Covers BTS, BUT, licences, classes prépa, écoles d\'ingénieurs, IFSI, etc. Returns session year, school name, UAI, sector, formation type code, long name, mention/specialty, apprenticeship availability, commune, official Parcoursup fiche URL. Source: Parcoursup open data via data.regionreunion.com.',
    {
      year: z.string().optional().describe('Parcoursup session year, 4 digits (e.g. "2024", "2025")'),
      query: z.string().optional().describe('Free-text search across formation name, specialty, mention'),
      commune: z.string().optional().describe('Commune name prefix match'),
      limit: z.number().int().min(1).max(500).default(50).describe('Max formations to return (1-500, default 50)'),
    },
    async ({ year, query, commune, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_PARCOURSUP, {
          where: buildWhere([
            year ? `annee = ${quote(year)}` : undefined,
            query ? `search(${quote(query)})` : undefined,
            commune ? `commune LIKE ${quote(`${commune}%`)}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_formations: data.total_count,
          formations: data.results.map((row) => ({
            session: pickString(row, ['annee']),
            school: pickString(row, ['etab_nom']),
            uai: pickString(row, ['etab_uai']),
            sector: pickString(row, ['tc']),
            formation_types: pickString(row, ['tf']),
            long_name: pickString(row, ['nm']),
            mention_specialty: pickString(row, ['fl']),
            apprenticeship: pickString(row, ['app']),
            commune: pickString(row, ['commune']),
            fiche_url: pickString(row, ['fiche']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search Parcoursup formations');
      }
    }
  );

  server.tool(
    'reunion_search_schools',
    'Search the official Annuaire de l\'Éducation Nationale (UAI directory) of geolocated primary and secondary schools in La Réunion: maternelles, élémentaires, collèges, lycées, both public and private. Returns UAI identifier, official name, main denomination, patronym, sector, address, postal code, commune, nature (school type), administrative state (open/closed), opening date, lat/lon. Source: Ministère de l\'Éducation Nationale via data.regionreunion.com.',
    {
      query: z.string().optional().describe('Free-text search across name, address, denomination'),
      commune: z.string().optional().describe('Commune name prefix match'),
      sector: z.enum(['Public', 'Privé']).optional().describe('School sector: "Public" or "Privé"'),
      nature: z.string().optional().describe('School nature/type prefix match. Examples: "ECOLE PRIMAIRE", "ECOLE MATERNELLE", "COLLEGE", "LYCEE GENERAL ET TECHNOLOGIQUE", "LYCEE PROFESSIONNEL"'),
      limit: z.number().int().min(1).max(200).default(50).describe('Max schools to return (1-200, default 50)'),
    },
    async ({ query, commune, sector, nature, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_SCHOOLS_GEO, {
          where: buildWhere([
            query ? `search(${quote(query)})` : undefined,
            commune ? `libelle_commune LIKE ${quote(`${commune}%`)}` : undefined,
            sector ? `secteur_public_prive_libe = ${quote(sector)}` : undefined,
            nature ? `nature_uai_libe LIKE ${quote(`${nature}%`)}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_schools: data.total_count,
          schools: data.results.map((row) => ({
            uai: pickString(row, ['numero_uai']),
            name: pickString(row, ['appellation_officielle']),
            main_denomination: pickString(row, ['denomination_principale']),
            patronym: pickString(row, ['patronyme_uai']),
            sector: pickString(row, ['secteur_public_prive_libe']),
            address: pickString(row, ['adresse_uai']),
            postal_code: pickString(row, ['code_postal_uai']),
            commune: pickString(row, ['libelle_commune']),
            nature: pickString(row, ['nature_uai_libe']),
            state: pickString(row, ['etat_etablissement_libe']),
            opening_date: pickString(row, ['date_ouverture']),
            lat: pickNumber(row, ['latitude']),
            lon: pickNumber(row, ['longitude']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search schools');
      }
    }
  );

  server.tool(
    'reunion_get_lycee_ips',
    'DEPP Indice de Position Sociale (IPS) for high schools (lycées) in La Réunion, by school year and pathway. Unlike colleges, lycées have separate IPS for the general/technological track (voie GT) and the vocational track (voie pro), plus a combined IPS. Returns school year, UAI, name, commune, sector, lycée type, three IPS values + standard deviations for GT and pro. Higher IPS = more privileged students.',
    {
      school: z.string().optional().describe('School name prefix match'),
      school_year: z.string().optional().describe('School year (rentrée), format YYYY-YYYY (e.g. "2022-2023")'),
      commune: z.string().optional().describe('Commune name prefix match'),
      limit: z.number().int().min(1).max(200).default(50).describe('Max rows to return (1-200, default 50)'),
    },
    async ({ school, school_year, commune, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_IPS_LYCEES, {
          where: buildWhere([
            school ? `nom_de_l_etablissment LIKE ${quote(`${school}%`)}` : undefined,
            school_year ? `rentree_scolaire = ${quote(school_year)}` : undefined,
            commune ? `nom_de_la_commune LIKE ${quote(`${commune}%`)}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_rows: data.total_count,
          schools: data.results.map((row) => ({
            school_year: pickString(row, ['rentree_scolaire']),
            uai: pickString(row, ['uai']),
            name: pickString(row, ['nom_de_l_etablissment']),
            commune: pickString(row, ['nom_de_la_commune']),
            sector: pickString(row, ['secteur']),
            lycee_type: pickString(row, ['type_de_lycee']),
            ips_general_technological: pickNumber(row, ['ips_voie_gt']),
            ips_vocational: pickNumber(row, ['ips_voie_pro']),
            ips_combined: pickNumber(row, ['ips_ensemble_gt_pro']),
            stddev_gt: pickNumber(row, ['ecart_type_de_l_ips_voie_gt']),
            stddev_pro: pickNumber(row, ['ecart_type_de_l_ips_voie_pro']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch lycée IPS');
      }
    }
  );

  server.tool(
    'reunion_list_priority_education_schools',
    'List schools in La Réunion that belong to the Education Prioritaire program (REP / REP+) — networks of schools serving disadvantaged areas, with extra resources, smaller class sizes, and bonus pay for teachers. REP+ is the more intensive tier. Returns UAI, school name, type, public/private status, EP label (REP/REP+), network-head UAI (collège tête de réseau), nearby QPV flag and name, student count, commune, postal code, lat/lon.',
    {
      commune: z.string().optional().describe('Commune name prefix match'),
      ep_label: z.string().optional().describe('Priority-education label prefix. Use "REP" for REP only, "REP+" for REP+ only'),
      limit: z.number().int().min(1).max(500).default(100).describe('Max schools to return (1-500, default 100)'),
    },
    async ({ commune, ep_label, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_PRIORITY_EDUCATION, {
          where: buildWhere([
            commune ? `nom_commune LIKE ${quote(`${commune}%`)}` : undefined,
            ep_label ? `ep_2022_2023 LIKE ${quote(`${ep_label}%`)}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_schools: data.total_count,
          schools: data.results.map((row) => ({
            uai: pickString(row, ['uai']),
            name: pickString(row, ['nom_etablissement']),
            type: pickString(row, ['type_etablissement']),
            status: pickString(row, ['statut_public_prive']),
            ep_label: pickString(row, ['ep_2022_2023']),
            network_head_uai: pickString(row, ['uai_tete_de_reseau']),
            qp_nearby: pickString(row, ['qp_a_proximite_o_n']),
            qp_name: pickString(row, ['nom_du_qp']),
            students_count: pickNumber(row, ['nombre_d_eleves']),
            commune: pickString(row, ['nom_commune']),
            postal_code: pickString(row, ['code_postal']),
            lat: pickNumber(row, ['latitude']),
            lon: pickNumber(row, ['longitude']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to list priority-education schools');
      }
    }
  );

  server.tool(
    'reunion_get_higher_education_enrollment',
    'Higher-education student enrollment in La Réunion (Université de La Réunion mainly, plus other public establishments under MESR tutelle), broken down by establishment × diploma × level × discipline × sub-discipline × sex. Each row gives the count of enrolled students for a (year, axis) combination, plus the count of new bachelors. Returns academic year, year, establishment name and type, diploma label, level (L/M/D), grand discipline, sub-discipline, sex, headcount, total headcount for context, new-bachelor count, commune. Sorted year then headcount descending.',
    {
      year: z.number().int().optional().describe('Academic-year start (4 digits, e.g. 2022 means 2022-2023 academic year)'),
      establishment: z.string().optional().describe('Establishment name prefix match (e.g. "Université de La Réunion")'),
      discipline: z.string().optional().describe('Grand discipline prefix match. Examples: "Droit", "Sciences", "Lettres et sciences humaines", "Médecine", "Économie"'),
      diploma: z.string().optional().describe('Diploma group prefix match. Examples: "Licence", "Master", "Doctorat", "DUT", "BUT"'),
      limit: z.number().int().min(1).max(500).default(100).describe('Max rows to return (1-500, default 100)'),
    },
    async ({ year, establishment, discipline, diploma, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_HIGHER_ED_STUDENTS, {
          where: buildWhere([
            year !== undefined ? `annee = ${year}` : undefined,
            establishment ? `etablissement_lib LIKE ${quote(`${establishment}%`)}` : undefined,
            discipline ? `gd_discipline_lib LIKE ${quote(`${discipline}%`)}` : undefined,
            diploma ? `diplome_lib LIKE ${quote(`${diploma}%`)}` : undefined,
          ]),
          order_by: 'annee DESC, effectif DESC',
          limit,
        });
        return jsonResult({
          total_rows: data.total_count,
          enrollments: data.results.map((row) => ({
            academic_year: pickString(row, ['annee_universitaire']),
            year: pickNumber(row, ['annee']),
            establishment: pickString(row, ['etablissement_lib']),
            establishment_type: pickString(row, ['etablissement_type']),
            diploma: pickString(row, ['diplome_lib']),
            level: pickString(row, ['niveau_lib']),
            discipline: pickString(row, ['gd_discipline_lib']),
            sub_discipline: pickString(row, ['discipline_lib']),
            sex: pickString(row, ['sexe_lib']),
            effectif: pickNumber(row, ['effectif']),
            effectif_total: pickNumber(row, ['effectif_total']),
            new_bachelors: pickNumber(row, ['nouv_bachelier']),
            commune: pickString(row, ['etablissement_commune']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch higher-education enrollment');
      }
    }
  );

  server.tool(
    'reunion_search_training_organizations',
    'Search professional-training organizations (Organismes de Formation, OF) and apprenticeship-training centers (CFA, including company-internal CFAs) declared in La Réunion. These are the providers eligible for CPF (Compte Personnel de Formation) funding and apprenticeship contracts. Returns SIRET, raison sociale, acronym, déclaration d\'activité (DA) number, CFA flags, NAF activity code, main activity, legal status, contact email/phone, address, and Qualiopi certification status (training and apprenticeship streams). Source: Région Réunion via data.regionreunion.com.',
    {
      query: z.string().optional().describe('Free-text search across name, activity, address'),
      commune: z.string().optional().describe('City prefix match on the physical address (e.g. "Saint-Denis")'),
      is_cfa: z.boolean().optional().describe('If true, return only CFAs (apprenticeship-training centers)'),
      limit: z.number().int().min(1).max(200).default(50).describe('Max organizations to return (1-200, default 50)'),
    },
    async ({ query, commune, is_cfa, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_TRAINING_ORGS, {
          where: buildWhere([
            query ? `search(${quote(query)})` : undefined,
            commune ? `adresse_physique_ville LIKE ${quote(`${commune}%`)}` : undefined,
            is_cfa ? `est_un_cfa = ${quote('Oui')}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_organizations: data.total_count,
          organizations: data.results.map((row) => ({
            siret: pickString(row, ['ndeg_siret']),
            name: pickString(row, ['raison_sociale']),
            acronym: pickString(row, ['sigle']),
            da_number: pickString(row, ['ndeg_da']),
            is_cfa: pickString(row, ['est_un_cfa']),
            is_company_cfa: pickString(row, ['est_un_cfa_d_entreprise']),
            naf_code: pickString(row, ['code_naf']),
            main_activity: pickString(row, ['activite_principale']),
            legal_status: pickString(row, ['statut_juridique']),
            email: pickString(row, ['e_mail']),
            phone: pickString(row, ['telephone']),
            city: pickString(row, ['adresse_physique_ville']),
            postal_code: pickString(row, ['adresse_physique_code_postal']),
            qualiopi_training: pickString(row, ['qualiopi_actions_de_formation']),
            qualiopi_apprenticeship: pickString(row, ['qualiopi_actions_de_formation_par_apprentissage']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search training organizations');
      }
    }
  );
}
