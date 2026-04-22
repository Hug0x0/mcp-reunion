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
    'Get the DEPP social position index (IPS) of Réunion middle schools (collèges).',
    {
      commune: z.string().optional().describe('Commune filter (prefix match)'),
      sector: z.enum(['Public', 'Privé sous contrat']).optional(),
      rentree: z.string().optional().describe('School year, e.g. "2022-2023"'),
      limit: z.number().int().min(1).max(500).default(100),
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
    'List Réunion schools labelled "Génération 2024" (sport-oriented label tied to the Paris Olympics).',
    {
      commune: z.string().optional(),
      type: z.string().optional().describe('Establishment type: école, collège, lycée, …'),
      limit: z.number().int().min(1).max(300).default(100),
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
    'Search post-baccalaureate training programs available via Parcoursup in Réunion.',
    {
      year: z.string().optional().describe('Session year, e.g. "2025"'),
      query: z.string().optional().describe('Free-text search on formation name/specialty'),
      commune: z.string().optional().describe('Commune filter (prefix match)'),
      limit: z.number().int().min(1).max(500).default(50),
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
    'Search geolocated primary and secondary schools in La Réunion (UAI directory).',
    {
      query: z.string().optional().describe('Free-text search'),
      commune: z.string().optional().describe('Commune filter (prefix match)'),
      sector: z.enum(['Public', 'Privé']).optional().describe('Sector filter'),
      nature: z.string().optional().describe('School nature filter (prefix match on nature_uai_libe, e.g. "COLLEGE")'),
      limit: z.number().int().min(1).max(200).default(50),
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
    'Social Position Index (IPS) for lycées in La Réunion, per school year and pathway.',
    {
      school: z.string().optional().describe('School name filter (prefix match)'),
      school_year: z.string().optional().describe('School year filter, e.g. "2022-2023"'),
      commune: z.string().optional().describe('Commune filter (prefix match)'),
      limit: z.number().int().min(1).max(200).default(50),
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
    'List REP / REP+ priority-education schools in La Réunion.',
    {
      commune: z.string().optional().describe('Commune filter (prefix match)'),
      ep_label: z.string().optional().describe('Priority-education label (prefix match on ep_2022_2023, e.g. "REP", "REP+")'),
      limit: z.number().int().min(1).max(500).default(100),
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
    'Higher-education student enrollment per establishment, discipline, and diploma in La Réunion.',
    {
      year: z.number().int().optional().describe('Academic year start (annee)'),
      establishment: z.string().optional().describe('Establishment name filter (prefix match)'),
      discipline: z.string().optional().describe('Grand discipline filter (prefix match)'),
      diploma: z.string().optional().describe('Diploma group filter (prefix match)'),
      limit: z.number().int().min(1).max(500).default(100),
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
    'Search training organizations (OF) and apprenticeship centers (CFA) in La Réunion.',
    {
      query: z.string().optional().describe('Free-text search'),
      commune: z.string().optional().describe('Commune filter (prefix match on physical-address city)'),
      is_cfa: z.boolean().optional().describe('Return only CFAs'),
      limit: z.number().int().min(1).max(200).default(50),
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
