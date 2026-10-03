// src/clients/data-gouv.ts
//
// Thin client for tabular-api.data.gouv.fr. It is used for national datasets
// that are not available (or are no longer available) on the regional portal.
//
// Query syntax: `?<Column>__<op>=<value>` where op ∈ {exact, contains, gt, ...}.
// Column names containing spaces/accents must be URL-encoded.

const BASE = 'https://tabular-api.data.gouv.fr/api';

export interface TabularResponse<T = Record<string, unknown>> {
  data: T[];
  links?: { profile?: string; next?: string };
  meta?: { total?: number; page_size?: number };
}

export interface TabularQuery {
  /** Equality filters keyed by exact column name (with spaces / accents). */
  filters?: Record<string, string | number | undefined>;
  /** Case-sensitive substring filters keyed by exact column name. */
  contains?: Record<string, string | number | undefined>;
  /** Page size (data.gouv default is 20, max 50). */
  pageSize?: number;
  /** Pagination page (1-indexed). */
  page?: number;
}

export class DataGouvTabularClient {
  private readonly timeout = 30000;

  async query<T = Record<string, unknown>>(
    resourceId: string,
    options: TabularQuery = {}
  ): Promise<TabularResponse<T>> {
    const url = new URL(`${BASE}/resources/${resourceId}/data/`);

    if (options.filters) {
      for (const [column, value] of Object.entries(options.filters)) {
        if (value === undefined || value === null || value === '') continue;
        // tabular-api expects `<column>__exact=<value>`
        url.searchParams.set(`${column}__exact`, String(value));
      }
    }
    if (options.contains) {
      for (const [column, value] of Object.entries(options.contains)) {
        if (value === undefined || value === null || value === '') continue;
        url.searchParams.set(`${column}__contains`, String(value));
      }
    }
    if (options.pageSize) url.searchParams.set('page_size', String(options.pageSize));
    if (options.page) url.searchParams.set('page', String(options.page));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await fetch(url.toString(), {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'mcp-reunion/1.2',
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`tabular-api ${response.status}: ${body.slice(0, 300)}`);
      }
      return (await response.json()) as TabularResponse<T>;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async queryAll<T = Record<string, unknown>>(
    resourceId: string,
    options: Omit<TabularQuery, 'page' | 'pageSize'> = {}
  ): Promise<TabularResponse<T>> {
    const pageSize = 50;
    const data: T[] = [];
    let page = 1;
    let total = 0;

    do {
      const response = await this.query<T>(resourceId, { ...options, page, pageSize });
      if (response.data.length === 0 && data.length < total) {
        throw new Error(`tabular-api pagination stopped before all ${total} rows were returned`);
      }
      data.push(...response.data);
      total = response.meta?.total ?? data.length;
      page += 1;
    } while (data.length < total);

    return {
      data,
      meta: { total, page_size: pageSize },
    };
  }
}

export const dataGouvClient = new DataGouvTabularClient();
