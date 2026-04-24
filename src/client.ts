// src/client.ts

import {
  CatalogResponse,
  DatasetMetadata,
  ODSQueryParams,
  ODSResponse,
  RecordObject,
} from './types.js';
import { quote, normalizeText } from './utils/helpers.js';

// Datasets that are stable registries (INSEE millésimé layers, national nomenclatures).
// They update at most once a year, so caching their responses per-session avoids
// thousands of redundant upstream calls when the agent cross-references communes / IRIS
// across many tools in a single conversation.
const REFERENTIAL_DATASETS: ReadonlySet<string> = new Set([
  'communes-millesime-france',
  'cantons-millesime-france',
  'intercommunalites-millesime-france',
  'iris-millesime-france',
  'les-20-quartiers-villesaintdenis',
  'quartiers-prioritaires-de-la-politique-de-la-ville-qpv',
  'laposte_hexasmaldatanova',
  'pnrun_2021',
]);

const REFERENTIAL_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * HTTP client for OpenDataSoft API (data.regionreunion.com)
 * No authentication required - completely free API
 */
export class ReunionClient {
  private readonly baseUrl = 'https://data.regionreunion.com/api/explore/v2.1/';
  private readonly timeout = 30000;
  private readonly maxRetries = 2;
  private readonly metadataCache = new Map<string, Promise<DatasetMetadata | undefined>>();
  private readonly recordsCache = new Map<string, { value: unknown; expiresAt: number }>();

  /**
   * Fetch records from a dataset
   */
  async getRecords<T extends RecordObject = RecordObject>(
    datasetId: string,
    params: ODSQueryParams = {}
  ): Promise<ODSResponse<T>> {
    const url = this.buildUrl(`/catalog/datasets/${datasetId}/records`, params);

    if (REFERENTIAL_DATASETS.has(datasetId)) {
      const now = Date.now();
      const cached = this.recordsCache.get(url);
      if (cached && cached.expiresAt > now) {
        return cached.value as ODSResponse<T>;
      }
      const value = await this.fetchJson<ODSResponse<T>>(url);
      this.recordsCache.set(url, { value, expiresAt: now + REFERENTIAL_TTL_MS });
      return value;
    }

    return this.fetchJson<ODSResponse<T>>(url);
  }

  /**
   * Clear the in-memory caches. Intended for tests.
   */
  clearCaches(): void {
    this.metadataCache.clear();
    this.recordsCache.clear();
  }

  /**
   * Fetch aggregated data from a dataset
   */
  async getAggregates<T extends RecordObject = RecordObject>(
    datasetId: string,
    select: string,
    options: {
      where?: string;
      groupBy?: string;
      orderBy?: string;
      limit?: number;
    } = {}
  ): Promise<ODSResponse<T>> {
    const params: Record<string, string | number | undefined> = { select };
    if (options.where) params.where = options.where;
    if (options.groupBy) params.group_by = options.groupBy;
    if (options.orderBy) params.order_by = options.orderBy;
    if (options.limit !== undefined) params.limit = options.limit;

    const url = this.buildUrl(`/catalog/datasets/${datasetId}/aggregates`, params);
    return this.fetchJson<ODSResponse<T>>(url);
  }

  /**
   * Search across all datasets
   */
  async searchDatasets(query: string): Promise<CatalogResponse> {
    const url = this.buildUrl('/catalog/datasets', {
      where: `search(${quote(query)})`,
      limit: 20,
    });
    return this.fetchJson<CatalogResponse>(url);
  }

  /**
   * List datasets with an optional raw ODSQL where clause.
   */
  async listDatasets(
    options: { where?: string; limit?: number; offset?: number } = {}
  ): Promise<CatalogResponse> {
    const url = this.buildUrl('/catalog/datasets', {
      where: options.where,
      limit: options.limit ?? 20,
      offset: options.offset,
    });
    return this.fetchJson<CatalogResponse>(url);
  }

  /**
   * Fetch dataset metadata from the catalog
   */
  async getDatasetMetadata(datasetId: string): Promise<DatasetMetadata | undefined> {
    if (!this.metadataCache.has(datasetId)) {
      const promise = this.fetchJson<CatalogResponse>(
        this.buildUrl('/catalog/datasets', {
          where: `dataset_id = ${quote(datasetId)}`,
          limit: 1,
        })
      ).then((data) => data.results[0]);

      this.metadataCache.set(datasetId, promise);
    }

    return this.metadataCache.get(datasetId);
  }

  /**
   * Check whether a dataset currently exists in the public catalog
   */
  async datasetExists(datasetId: string): Promise<boolean> {
    return Boolean(await this.getDatasetMetadata(datasetId));
  }

  /**
   * Resolve the first matching field name for a dataset
   */
  async resolveField(
    datasetId: string,
    candidates: string[]
  ): Promise<string | undefined> {
    const metadata = await this.getDatasetMetadata(datasetId);
    const fields = metadata?.fields ?? [];

    if (fields.length === 0) {
      return candidates[0];
    }

    const byNormalizedName = new Map(
      fields.map((field) => [normalizeText(field.name), field.name] as const)
    );

    for (const candidate of candidates) {
      const direct = byNormalizedName.get(normalizeText(candidate));
      if (direct) {
        return direct;
      }
    }

    const fieldNames = fields.map((field) => field.name);
    for (const candidate of candidates) {
      const normalizedCandidate = normalizeText(candidate);
      const partial = fieldNames.find((fieldName) =>
        normalizeText(fieldName).includes(normalizedCandidate)
      );
      if (partial) {
        return partial;
      }
    }

    return candidates[0];
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(
    path: string,
    params: Record<string, string | number | undefined>
  ): string {
    const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
    const url = new URL(normalizedPath, this.baseUrl);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    return url.toString();
  }

  /**
   * Execute HTTP request with retries and timeout handling
   */
  private async fetchJson<T>(url: string, remainingRetries = this.maxRetries): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'mcp-reunion/1.0',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status >= 500 && remainingRetries > 0) {
          await this.delay(250);
          return this.fetchJson<T>(url, remainingRetries - 1);
        }
        throw new Error(
          `API error ${response.status}: ${response.statusText}. ${errorText}`
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${this.timeout}ms`);
        }

        if (remainingRetries > 0 && this.isRetryableError(error)) {
          await this.delay(250);
          return this.fetchJson<T>(url, remainingRetries - 1);
        }

        throw error;
      }
      throw new Error('Unknown error occurred');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private isRetryableError(error: Error): boolean {
    return /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i.test(error.message);
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const client = new ReunionClient();
