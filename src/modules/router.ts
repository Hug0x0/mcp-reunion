// src/modules/router.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { jsonResult, normalizeText } from '../utils/helpers.js';

type ToolSuggestion = {
  topic: string;
  tools: string[];
  datasets?: string[];
  reason: string;
};

const RULES: Array<{ topic: string; keywords: string[]; suggestion: Omit<ToolSuggestion, 'topic'> }> = [
  {
    topic: 'commune profile',
    keywords: ['commune', 'ville', 'saint-denis', 'saint-pierre', 'tampon', 'population', 'compare'],
    suggestion: {
      tools: ['reunion_find_commune', 'reunion_commune_profile', 'reunion_compare_communes'],
      datasets: ['population-francaise-communespublic', 'communes-millesime-france'],
      reason: 'Use commune composite tools for multi-dataset local profiles and side-by-side comparisons.',
    },
  },
  {
    topic: 'transport',
    keywords: ['transport', 'bus', 'car jaune', 'gtfs', 'route', 'rn1', 'rn2', 'traffic', 'trafic', 'accident'],
    suggestion: {
      tools: ['reunion_list_car_jaune_routes', 'reunion_search_car_jaune_stops', 'reunion_get_road_traffic', 'reunion_search_road_accidents'],
      datasets: ['donnees-gtfs-lareunion', 'gtfs-routes-cars-jaunes-lareunion', 'trafic-mja-rn-lareunion'],
      reason: 'Transport questions usually need a mix of static GTFS, road traffic, and accident datasets.',
    },
  },
  {
    topic: 'health',
    keywords: ['sante', 'santé', 'medecin', 'médecin', 'hopital', 'hôpital', 'finess', 'covid', 'pathologie'],
    suggestion: {
      tools: ['reunion_search_health_professionals', 'reunion_search_finess_establishments', 'reunion_get_pathology_prevalence'],
      datasets: ['annuaire-des-professionnels-de-santepublic', 'etablissements-du-domaine-sanitaire-et-social-a-la-reunion'],
      reason: 'Health questions often combine professional directories, FINESS establishments, and pathology prevalence.',
    },
  },
  {
    topic: 'education',
    keywords: ['ecole', 'école', 'college', 'collège', 'lycee', 'lycée', 'ips', 'parcoursup', 'formation'],
    suggestion: {
      tools: ['reunion_search_schools', 'reunion_get_college_ips', 'reunion_get_lycee_ips', 'reunion_search_parcoursup_formations'],
      datasets: ['adresse-et-geolocalisation-des-etablissements-d-enseignement-du-premier-et-secon'],
      reason: 'Education questions are covered by school geolocation, IPS, priority education, and Parcoursup tools.',
    },
  },
  {
    topic: 'tourism',
    keywords: ['tourisme', 'tourism', 'randonnée', 'randonnee', 'sentier', 'hotel', 'hôtel', 'hebergement', 'hébergement', 'musee', 'musée'],
    suggestion: {
      tools: ['reunion_get_tourism_frequentation', 'reunion_list_hiking_circuits', 'reunion_list_family_trails', 'reunion_search_classified_accommodations'],
      datasets: ['frequentation-touristique-mensuelle-a-la-reunion-depuis-2017', 'circuits-rendonnees-lareunion-wssoubik'],
      reason: 'Tourism questions need tourism frequentation plus activity/accommodation datasets.',
    },
  },
  {
    topic: 'elections',
    keywords: ['election', 'élection', 'legislative', 'législative', 'europeenne', 'européenne', 'presidentielle', 'présidentielle', 'vote'],
    suggestion: {
      tools: ['reunion_get_legislative_2024_round1', 'reunion_get_legislative_2024_round2', 'reunion_get_european_2024', 'reunion_get_presidential_2022_round1'],
      reason: 'Election questions can use 2024 data.gouv.fr tools and 2022 regional polling-station datasets.',
    },
  },
  {
    topic: 'housing and urbanism',
    keywords: ['logement', 'housing', 'immobilier', 'foncier', 'plu', 'urbanisme', 'permis', 'construction'],
    suggestion: {
      tools: ['reunion_get_housing_overview', 'reunion_search_real_estate_transactions', 'reunion_search_plu_zones', 'reunion_search_building_permits'],
      datasets: ['demande-de-valeurs-foncierespublic', 'base-permanente-des-plu-de-la-reunion'],
      reason: 'Housing questions often require social-housing indicators, DVF transactions, PLU zones, and permits.',
    },
  },
  {
    topic: 'environment and risk',
    keywords: ['environnement', 'air', 'dechet', 'déchet', 'eau', 'znieff', 'parc national', 'pollution', 'risque'],
    suggestion: {
      tools: ['reunion_get_air_quality', 'reunion_get_waste_tonnage', 'reunion_list_znieff', 'reunion_list_water_management_points'],
      datasets: ['world-air-quality-openaq', 'tonnage-dechets-menagers-et-assimiles-a-la-reunion'],
      reason: 'Environment questions combine air quality, waste, protected zones, and water-management datasets.',
    },
  },
  {
    topic: 'catalog discovery',
    keywords: ['dataset', 'donnee', 'donnée', 'catalogue', 'catalog', 'source', 'schema', 'champ'],
    suggestion: {
      tools: ['reunion_search_catalog', 'reunion_inspect_dataset', 'reunion_query_dataset'],
      reason: 'Use catalog tools when no dedicated module is obvious or when the user asks about source data itself.',
    },
  },
];

export function findRelevantTools(question: string, limit = 5): ToolSuggestion[] {
  const normalizedQuestion = normalizeText(question);
  const ranked = RULES.map((rule) => {
    const score = rule.keywords.filter((keyword) => normalizedQuestion.includes(normalizeText(keyword))).length;
    return { score, suggestion: { topic: rule.topic, ...rule.suggestion } };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.suggestion.topic.localeCompare(b.suggestion.topic))
    .slice(0, limit)
    .map((entry) => entry.suggestion);

  return ranked.length > 0
    ? ranked
    : [
        {
          topic: 'catalog discovery',
          tools: ['reunion_search_catalog', 'reunion_inspect_dataset', 'reunion_query_dataset'],
          reason: 'No deterministic topic matched. Start with catalog discovery, then promote useful datasets to dedicated tools.',
        },
      ];
}

export function registerRouterTools(server: McpServer): void {
  server.tool(
    'reunion_find_relevant_tools',
    'Route a natural-language question to likely mcp-reunion tools and datasets. This is a deterministic helper: it does not call an LLM, does not require API keys, and is intended to help agents choose the best tool flow before querying data.',
    {
      question: z.string().min(1).describe('Natural-language user question, in French or English'),
      limit: z.number().int().min(1).max(10).default(5).describe('Maximum number of topic suggestions to return'),
    },
    async ({ question, limit }) =>
      jsonResult({
        question,
        suggestions: findRelevantTools(question, limit),
      })
  );
}

