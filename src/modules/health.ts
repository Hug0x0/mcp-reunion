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
    'Search the CNAM Annuaire Santé directory of registered health professionals practicing in La Réunion. Returns name, profession, full address, postal code, phone, mode of practice, convention status (secteur 1/2), and SESAM-Vitale acceptance. Source: CNAM via data.regionreunion.com. Use this to find doctors, nurses, dentists, pharmacists, midwives, etc. by profession or location. For posted fees per act in La Possession specifically, use reunion_search_possession_health_pros.',
    {
      profession: z.string().optional().describe('Profession label, prefix match. Examples: "Médecin", "Médecin généraliste", "Chirurgien-dentiste", "Infirmier", "Masseur-Kinésithérapeute", "Sage-femme", "Pharmacien"'),
      commune: z.string().optional().describe('Commune name to match against the address (substring search). Example: "Saint-Denis", "Saint-Pierre"'),
      postal_code: z.string().optional().describe('Réunion postal code (exact match), e.g. "97400" for Saint-Denis, "97410" for Saint-Pierre'),
      limit: z.number().int().min(1).max(200).default(50).describe('Max results to return (1-200, default 50)'),
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
    'Daily COVID-19 emergency-room attendance and SOS Médecins activity in La Réunion, broken down by age class. Returns per-day counts for ER COVID visits, total ER visits, COVID-related hospitalizations from ER, and SOS Médecins COVID acts. Source: Santé publique France via data.regionreunion.com. Sorted most recent first. Combine with reunion_get_covid_hospital_stats for in-hospital indicators.',
    {
      from: z.string().optional().describe('Inclusive lower bound on date, ISO format YYYY-MM-DD (e.g. "2021-01-01")'),
      to: z.string().optional().describe('Inclusive upper bound on date, ISO format YYYY-MM-DD (e.g. "2022-12-31")'),
      age_label: z.string().optional().describe('Age-bracket label as published by SpF, e.g. "0-14 ans", "15-44 ans", "45-64 ans", "65-74 ans", "75 ans et plus", "Tous âges"'),
      limit: z.number().int().min(1).max(500).default(50).describe('Max rows to return (1-500, default 50)'),
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
    'Daily in-hospital COVID-19 indicators for La Réunion: occupied conventional beds, occupied ICU beds, cumulative discharges, cumulative deaths, and daily new admissions / new ICU / new deaths / new discharges, with sex breakdown (Hommes/Femmes/Tous). Source: Santé publique France SI-VIC via data.regionreunion.com. Sorted most recent first. For ER attendance and SOS Médecins acts, use reunion_get_covid_emergency_stats.',
    {
      from: z.string().optional().describe('Inclusive lower bound on date, ISO format YYYY-MM-DD'),
      to: z.string().optional().describe('Inclusive upper bound on date, ISO format YYYY-MM-DD'),
      sex: z.enum(['Hommes', 'Femmes', 'Tous']).optional().describe('Sex filter: "Hommes" (men), "Femmes" (women), or "Tous" (combined)'),
      limit: z.number().int().min(1).max(500).default(50).describe('Max rows to return (1-500, default 50)'),
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
    'Patient counts and prevalence rates by pathology, sex and age group in La Réunion, from the CNAM Cartographie des pathologies (built on Sniiram-DCIR claims data). Pathologies are organized in a 3-level taxonomy (e.g. Cardio-vasculaire > Maladies coronaires > Syndrome coronarien aigu). Returns: year, pathology levels 1/2/3, age class, sex, patient count (ntop), reference population (npop), prevalence rate. Sorted by patient count descending.',
    {
      pathology: z.string().optional().describe('Substring search across pathology levels 1/2/3 labels (in French). Examples: "diabète", "cancer", "cardiovasculaire", "psychiatrique", "Maladies du foie"'),
      age_label: z.string().optional().describe('Age-group label as published by CNAM. Examples: "Tous âges", "0-19 ans", "20-39 ans", "40-59 ans", "60-74 ans", "75 ans et +"'),
      sex_label: z.string().optional().describe('Sex label (lowercase): "hommes", "femmes", or "tous sexes"'),
      year: z.string().optional().describe('Year to filter on, 4 digits e.g. "2021". Data typically available 2015-2022'),
      limit: z.number().int().min(1).max(500).default(50).describe('Max rows to return (1-500, default 50)'),
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
    'Search the FINESS national repertory of health and social-care establishments, restricted to La Réunion. Covers hospitals (CHU, CH, cliniques), EHPAD/retirement homes, mental-health facilities, dialysis centers, social-care structures (foyers, IME, ESAT), HAD, MAS, FAM, etc. Returns FINESS IDs (geographic + legal entity), names, category, status (public/private), tariff mode, address, phone, opening dates, SIRET. Source: Ministère de la Santé via data.regionreunion.com.',
    {
      query: z.string().optional().describe('Free-text search across establishment name and address'),
      commune: z.string().optional().describe('Commune prefix match (e.g. "Saint-" matches all "Saint-..." communes)'),
      category_label: z.string().optional().describe('Establishment category label prefix. Examples: "Centre Hospitalier", "Etablissement d\'Hébergement pour Personnes Agées Dépendantes", "Centre Médico-Psychologique", "Pharmacie", "Cabinet"'),
      limit: z.number().int().min(1).max(500).default(50).describe('Max establishments to return (1-500, default 50)'),
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
    'Search health professionals practicing specifically in La Possession (commune in west Réunion), with posted fees per technical act. Unlike reunion_search_health_professionals which is directory-only, this returns the typical price per act, the secteur 1 OPTAM/OPTAM-CO rate, the off-OPTAM rate, and the social security reimbursement base. Useful to estimate out-of-pocket costs. Source: open data Mairie de La Possession via data.regionreunion.com.',
    {
      profession: z.string().optional().describe('Profession prefix match. Examples: "Médecin", "Dentiste", "Kinésithérapeute"'),
      act_family: z.string().optional().describe('Technical-act family prefix match. Examples: "Consultation", "Soins dentaires", "Imagerie"'),
      convention: z.string().optional().describe('Convention status prefix. Examples: "Secteur 1", "Secteur 2", "Non conventionné"'),
      limit: z.number().int().min(1).max(300).default(50).describe('Max rows to return (1-300, default 50)'),
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
