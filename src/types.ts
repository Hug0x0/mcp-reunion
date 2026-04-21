// src/types.ts

/**
 * Generic OpenDataSoft record.
 */
export interface RecordObject {
  [key: string]: unknown;
}

/**
 * OpenDataSoft API response structure.
 */
export interface ODSResponse<T extends RecordObject = RecordObject> {
  total_count: number;
  results: T[];
}

/**
 * Query parameters for API requests.
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
 * Catalog field metadata.
 */
export interface CatalogField {
  name: string;
  type?: string;
  label?: string;
}

/**
 * Dataset metadata from the catalog endpoint.
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
 * Catalog response structure.
 */
export interface CatalogResponse {
  total_count: number;
  results: DatasetMetadata[];
}

/**
 * Tool result content.
 */
export interface ToolResult extends RecordObject {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
  structuredContent?: RecordObject;
}
