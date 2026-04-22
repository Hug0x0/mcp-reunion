// src/modules/health.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, pickNumber, pickString, quote } from '../utils/helpers.js';

const DATASET_HEALTH_PROS = 'annuaire-des-professionnels-de-santepublic';
const DATASET_COVID_EMERGENCY = 'donnees-covid19-lareunion';
const DATASET_COVID_HOSPITAL = 'donnees-hospitalieres-covid19-lareunion';
const DATASET_PATHOLOGIES = 'effectif-de-patients-par-pathologie-sexe-classe-d-age-a-la-reunion';
const DATASET_FINESS = 'etablissements-du-domaine-sanitaire-et-social-a-la-reunion';
const DATASET_POSSESSION_PROS = 'professionnels-de-sante-a-la-possession';

export function registerHealthTools(server: McpServer): void {
  server.tool(
    'reunion_search_health_professionals',
    'Search the CNAM health-professional directory, filtered to Réunion.',
    {
      profession: z.string().optional().describe('Profession name (prefix match), e.g. "Médecin", "Dentiste", "Infirmier"'),
      commune: z.string().optional().describe('Commune filter (substring on address)'),
      postal_code: z.string().optional().describe('Postal code filter'),
      limit: z.number().int().min(1).max(200).default(50),
    },
    async ({ profession, commune, postal_code, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_HEALTH_PROS, {
          where: buildWhere([
            `reg_name = ${quote('La Réunion')}`,
            profession ? `libelle_profession LIKE ${quote(`${profession}%`)}` : undefined,
            commune ? `search(${quote(commune)})` : undefined,
            postal_code ? `code_postal = ${quote(postal_code)}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_professionals: data.total_count,
          professionals: data.results.map((row) => ({
            name: pickString(row, ['nom']),
            title: pickString(row, ['civilite']),
            profession: pickString(row, ['libelle_profession']),
            address: [pickString(row, ['adresse3']), pickString(row, ['adresse4'])]
              .filter(Boolean)
              .join(' '),
            postal_code: pickString(row, ['code_postal']),
            phone: pickString(row, ['telephone']),
            practice: pickString(row, ['exercice_particulier']),
            nature: pickString(row, ['nature_exercice']),
            convention: pickString(row, ['convention']),
            sesam_vitale: pickString(row, ['sesam_vitale']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search health professionals');
      }
    }
  );

  server.tool(
    'reunion_get_covid_emergency_stats',
    'Get Réunion daily COVID-19 emergency-room attendances and SOS Médecins acts (age/sex breakdown).',
    {
      from: z.string().optional().describe('ISO date lower bound'),
      to: z.string().optional().describe('ISO date upper bound'),
      age_label: z.string().optional().describe('Age-bracket label filter'),
      limit: z.number().int().min(1).max(500).default(50),
    },
    async ({ from, to, age_label, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_COVID_EMERGENCY, {
          where: buildWhere([
            from ? `date >= date${quote(from)}` : undefined,
            to ? `date <= date${quote(to)}` : undefined,
            age_label ? `age_label = ${quote(age_label)}` : undefined,
          ]),
          order_by: 'date DESC',
          limit,
        });
        return jsonResult({
          total_rows: data.total_count,
          series: data.results.map((row) => ({
            date: pickString(row, ['date']),
            age_label: pickString(row, ['age_label']),
            emergency_covid: pickNumber(row, ['nb_pass_emgy_covid']),
            emergency_total: pickNumber(row, ['tot_pass_emgy']),
            hospitalizations_covid: pickNumber(row, ['nb_ho_emgy_covid']),
            sos_medecins_covid: pickNumber(row, ['nb_acte_sos_covid']),
            sos_medecins_total: pickNumber(row, ['tot_acte_sos']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch COVID emergency stats');
      }
    }
  );

  server.tool(
    'reunion_get_covid_hospital_stats',
    'Get Réunion daily COVID-19 hospital indicators (beds, ICU, discharges, deaths).',
    {
      from: z.string().optional(),
      to: z.string().optional(),
      sex: z.enum(['Hommes', 'Femmes', 'Tous']).optional(),
      limit: z.number().int().min(1).max(500).default(50),
    },
    async ({ from, to, sex, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_COVID_HOSPITAL, {
          where: buildWhere([
            from ? `date >= date${quote(from)}` : undefined,
            to ? `date <= date${quote(to)}` : undefined,
            sex ? `sex = ${quote(sex)}` : undefined,
          ]),
          order_by: 'date DESC',
          limit,
        });
        return jsonResult({
          total_rows: data.total_count,
          series: data.results.map((row) => ({
            date: pickString(row, ['date']),
            sex: pickString(row, ['sex']),
            hospitalized: pickNumber(row, ['day_hosp']),
            intensive_care: pickNumber(row, ['day_intcare']),
            discharges_total: pickNumber(row, ['tot_out']),
            deaths_total: pickNumber(row, ['tot_death']),
            new_hospitalizations: pickNumber(row, ['day_hosp_new']),
            new_intensive_care: pickNumber(row, ['day_intcare_new']),
            new_deaths: pickNumber(row, ['day_death_new']),
            new_discharges: pickNumber(row, ['day_out_new']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch COVID hospital stats');
      }
    }
  );

  server.tool(
    'reunion_get_pathology_prevalence',
    'Get Réunion patient counts and prevalence by pathology, sex and age group (Sniiram-DCIR).',
    {
      pathology: z.string().optional().describe('Pathology search on level 1/2/3 labels'),
      age_label: z.string().optional().describe('Age-group label filter'),
      sex_label: z.string().optional().describe('Sex label filter: "hommes", "femmes", "tous sexes"'),
      year: z.string().optional().describe('Year filter, e.g. "2021"'),
      limit: z.number().int().min(1).max(500).default(50),
    },
    async ({ pathology, age_label, sex_label, year, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_PATHOLOGIES, {
          where: buildWhere([
            pathology
              ? `(patho_niv1 LIKE ${quote(`%${pathology}%`)} OR patho_niv2 LIKE ${quote(`%${pathology}%`)} OR patho_niv3 LIKE ${quote(`%${pathology}%`)})`
              : undefined,
            age_label ? `libelle_classe_age = ${quote(age_label)}` : undefined,
            sex_label ? `libelle_sexe = ${quote(sex_label)}` : undefined,
            year ? `annee = date${quote(`${year}-01-01`)}` : undefined,
          ]),
          order_by: 'ntop DESC',
          limit,
        });
        return jsonResult({
          total_rows: data.total_count,
          rows: data.results.map((row) => ({
            year: pickString(row, ['annee']),
            pathology_l1: pickString(row, ['patho_niv1']),
            pathology_l2: pickString(row, ['patho_niv2']),
            pathology_l3: pickString(row, ['patho_niv3']),
            age: pickString(row, ['libelle_classe_age']),
            sex: pickString(row, ['libelle_sexe']),
            patient_count: pickNumber(row, ['ntop']),
            population: pickNumber(row, ['npop']),
            prevalence: pickNumber(row, ['prev']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to fetch pathology prevalence');
      }
    }
  );

  server.tool(
    'reunion_search_finess_establishments',
    'Search Réunion health and social-care FINESS establishments (hospitals, EHPAD, clinics, social-care structures).',
    {
      query: z.string().optional().describe('Free-text search on establishment name / address'),
      commune: z.string().optional().describe('Commune filter (prefix match)'),
      category_label: z.string().optional().describe('Category label filter (prefix match)'),
      limit: z.number().int().min(1).max(500).default(50),
    },
    async ({ query, commune, category_label, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_FINESS, {
          where: buildWhere([
            query ? `search(${quote(query)})` : undefined,
            commune ? `commune LIKE ${quote(`${commune}%`)}` : undefined,
            category_label ? `libcategetab LIKE ${quote(`${category_label}%`)}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_establishments: data.total_count,
          establishments: data.results.map((row) => ({
            finess_id: pickString(row, ['nofinesset']),
            legal_entity_id: pickString(row, ['nofinessej']),
            name: pickString(row, ['rs']),
            long_name: pickString(row, ['rslongue']),
            category: pickString(row, ['libcategetab']),
            aggregate_category: pickString(row, ['libcategagretab']),
            status: pickString(row, ['libsph']),
            tariff_mode: pickString(row, ['libmft']),
            commune: pickString(row, ['commune']),
            address: pickString(row, ['address']),
            phone: pickString(row, ['telephone']),
            opened_on: pickString(row, ['dateouv']),
            authorized_on: pickString(row, ['dateautor']),
            siret: pickString(row, ['siret']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search FINESS establishments');
      }
    }
  );

  server.tool(
    'reunion_search_possession_health_pros',
    'Search health professionals practicing in La Possession, with posted fees per act type.',
    {
      profession: z.string().optional().describe('Profession filter (prefix match)'),
      act_family: z.string().optional().describe('Technical-act family filter (prefix match)'),
      convention: z.string().optional().describe('Convention status filter'),
      limit: z.number().int().min(1).max(300).default(50),
    },
    async ({ profession, act_family, convention, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(DATASET_POSSESSION_PROS, {
          where: buildWhere([
            profession ? `profession LIKE ${quote(`${profession}%`)}` : undefined,
            act_family ? `famille_de_l_acte_technique_realise LIKE ${quote(`${act_family}%`)}` : undefined,
            convention ? `convention_et_cas LIKE ${quote(`${convention}%`)}` : undefined,
          ]),
          limit,
        });
        return jsonResult({
          total_rows: data.total_count,
          professionals: data.results.map((row) => ({
            name: pickString(row, ['nom_du_professionnel']),
            title: pickString(row, ['civilite']),
            profession: pickString(row, ['profession']),
            address: pickString(row, ['adresse']),
            commune: pickString(row, ['commune']),
            phone: pickString(row, ['numero_de_telephone']),
            convention: pickString(row, ['convention_et_cas']),
            sesam_vitale: pickString(row, ['sesam_vitale']),
            act_family: pickString(row, ['famille_de_l_acte_technique_realise']),
            act: pickString(row, ['acte_technique_realise']),
            typical_amount_eur: pickNumber(row, ['montant_generalement_constate']),
            sector_1_rate_eur: pickNumber(row, ['tarif_secteur_1_adherent_optam_optam_co']),
            off_sector_1_rate_eur: pickNumber(row, ['tarif_hors_secteur_1_hors_adherent_optam_optam_co']),
            reimbursement_base_eur: pickNumber(row, ['base_de_remboursement']),
          })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search Possession health pros');
      }
    }
  );
}
