// src/clients/data-gouv.ts
//
// Thin client for tabular-api.data.gouv.fr — lets us query the Ministry of
// Interior's France-wide CSVs (post-2022 election results that the regional
// data.regionreunion.com portal doesn't carry) filtered server-side.
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
  /** Equality / contains filters keyed by exact column name (with spaces / accents). */
  filters?: Record<string, string | number | undefined>;
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
}

export const dataGouvClient = new DataGouvTabularClient();
