// src/types.ts

/**
 * Generic OpenDataSoft record
 */
export interface RecordObject {
  [key: string]: unknown;
}

/**
 * OpenDataSoft API response structure
 */
export interface ODSResponse<T extends RecordObject = RecordObject> {
  total_count: number;
  results: T[];
}

/**
 * Query parameters for API requests
 */
export interface ODSQueryParams {
  [key: string]: string | number | undefined;
  select?: string;
  where?: string;
  limit?: number;
  offset?: number;
  order_by?: string;
  group_by?: string;
}

/**
 * Catalog field metadata
 */
export interface CatalogField {
  name: string;
  type?: string;
  label?: string;
}

/**
 * Dataset metadata from the catalog endpoint
 */
export interface DatasetMetadata {
  dataset_id: string;
  dataset_uid?: string;
  has_records?: boolean;
  fields: CatalogField[];
  attachments?: unknown[];
  metas?: {
    default?: {
      title?: string;
      description?: string;
      records_count?: number;
    };
  };
}

/**
 * Catalog response structure
 */
export interface CatalogResponse {
  total_count: number;
  results: DatasetMetadata[];
}

/**
 * Public holiday record
 */
export interface PublicHoliday extends RecordObject {
  date_ferie?: string;
  jour_ferie?: string;
  nom_jour_ferie: string;
  type?: string;
  type_jour?: string;
  secteur?: string;
  zone?: string;
  jour_chome?: string;
  is_chome?: boolean;
}

/**
 * Company record from RIDET
 */
export interface Company extends RecordObject {
  ridet?: string;
  rid7?: string;
  denomination: string;
  sigle?: string;
  forme_juridique?: string;
  code_formjur?: string;
  libelle_formjur?: string;
  ape?: string;
  code_ape?: string;
  ape_libelle?: string;
  libelle_naf?: string;
  commune?: string;
  libelle_commune?: string;
  province?: string;
  date_creation?: string;
  date_entreprises_actives?: string;
  effectif_tranche?: string;
}

/**
 * Business establishment record
 */
export interface Establishment extends RecordObject {
  ridet?: string;
  rid7?: string;
  nic?: string;
  ndegetablissement?: string;
  enseigne?: string;
  adresse?: string;
  commune?: string;
  libelle_commune?: string;
  ape?: string;
  code_ape?: string;
  ape_libelle?: string;
  libelle_naf?: string;
  siege?: boolean;
}

/**
 * Job offer record
 */
export interface JobOffer extends RecordObject {
  reference?: string;
  uuid?: string;
  intitule?: string;
  titre?: string;
  employeur?: string;
  designation?: string;
  commune?: string;
  ville?: string;
  contrat?: string;
  type_contrat?: string;
  salaire?: string;
  date_publication?: string;
  created_at?: string;
  description?: string;
}

/**
 * Weather station record
 */
export interface WeatherStation extends RecordObject {
  nom_station?: string;
  commune?: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  type_station?: string;
}

/**
 * Mining title record
 */
export interface MiningTitle extends RecordObject {
  type_titre?: string;
  numero?: string;
  titulaire?: string;
  commune?: string;
  superficie_ha?: number;
  date_attribution?: string;
  date_echeance?: string;
  statut?: string;
}

/**
 * Metal production record
 */
export interface MetalProduction extends RecordObject {
  annee: number;
  mois?: number;
  type?: string;
  type_produit?: string;
  quantite?: number;
  tonnage_brut?: number;
  tonnage_nickel_contenu?: number;
  tonnage_cobalt_contenu?: number;
  unite?: string;
}

/**
 * Public facility record
 */
export interface PublicFacility extends RecordObject {
  nom?: string;
  lib_norme?: string;
  type?: string;
  lib_court?: string;
  famille?: string;
  theme1?: string;
  commune?: string;
  apparten?: string;
  adresse?: string;
  libadrs?: string;
  latitude?: number;
  longitude?: number;
  geo_point_2d?: {
    lat?: number;
    lon?: number;
  };
}

/**
 * Census record
 */
export interface CensusRecord extends RecordObject {
  province?: string;
  prov?: string;
  sexe?: string;
  genre?: string;
  age?: number;
  agea?: number;
  diplome?: string;
  dipl?: string;
  activite?: string;
  empl?: string;
  transport_principal?: string;
  trans?: string;
}

/**
 * GR Trail stage
 */
export interface TrailStage extends RecordObject {
  etape?: number;
  nom: string;
  depart?: string;
  arrivee?: string;
  distance_km?: number;
  longueur?: number;
  denivele_positif?: number;
  duree_estimee?: string;
}

/**
 * Tool result content
 */
export interface ToolResult extends RecordObject {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
  structuredContent?: RecordObject;
}
