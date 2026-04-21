// src/modules/catalog.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';
import { RecordObject } from '../types.js';
import { buildWhere, errorResult, jsonResult, quote } from '../utils/helpers.js';

export function registerCatalogTools(server: McpServer): void {
  server.tool(
    'reunion_search_catalog',
    'Search the full data.regionreunion.com catalog (~270 datasets) by keywords and/or theme. Use this to discover datasets that are not wired to a dedicated tool yet, then call reunion_inspect_dataset and reunion_query_dataset to work with them.',
    {
      query: z.string().optional().describe('Free-text search on titles, descriptions, keywords'),
      theme: z.string().optional().describe('Theme filter (prefix match), e.g. "Environnement", "Transports", "Éducation"'),
      publisher: z.string().optional().describe('Publisher filter (substring match)'),
      limit: z.number().int().min(1).max(100).default(20),
    },
    async ({ query, theme, publisher, limit }) => {
      try {
        const conditions = buildWhere([
          query ? `search(${quote(query)})` : undefined,
          theme ? `theme LIKE ${quote(`${theme}%`)}` : undefined,
          publisher ? `publisher LIKE ${quote(`%${publisher}%`)}` : undefined,
        ]);

        const data = await client.listDatasets({ where: conditions, limit });

        return jsonResult({
          total_matches: data.total_count,
          datasets: data.results.map((row) => {
            const metas = (row.metas?.default ?? {}) as RecordObject;
            return {
              dataset_id: row.dataset_id,
              title: metas.title,
              description:
                typeof metas.description === 'string'
                  ? metas.description.replace(/<[^>]+>/g, '').slice(0, 400)
                  : undefined,
              theme: metas.theme,
              publisher: metas.publisher,
              records_count: metas.records_count,
              modified: metas.modified,
            };
          }),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search catalog');
      }
    }
  );

  server.tool(
    'reunion_inspect_dataset',
    'Inspect one dataset: return its schema (fields + types), title, description, record count, and features. Use this before calling reunion_query_dataset so you know which fields you can filter on.',
    {
      dataset_id: z.string().describe('Dataset identifier as returned by reunion_search_catalog'),
    },
    async ({ dataset_id }) => {
      try {
        const meta = await client.getDatasetMetadata(dataset_id);
        if (!meta) {
          return jsonResult({ found: false, dataset_id });
        }
        const metas = meta.metas?.default ?? {};
        return jsonResult({
          found: true,
          dataset_id: meta.dataset_id,
          title: metas.title,
          description:
            typeof metas.description === 'string'
              ? metas.description.replace(/<[^>]+>/g, '').slice(0, 1000)
              : undefined,
          records_count: metas.records_count,
          has_records: meta.has_records,
          fields: meta.fields.map((f) => ({ name: f.name, type: f.type, label: f.label })),
        });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to inspect dataset');
      }
    }
  );

  server.tool(
    'reunion_query_dataset',
    'Generic escape hatch: fetch records from ANY data.regionreunion.com dataset with a raw ODSQL where clause. Call reunion_inspect_dataset first to know the fields. ODSQL supports operators like =, !=, >, <, LIKE, AND, OR, and the search() function.',
    {
      dataset_id: z.string().describe('Dataset identifier'),
      where: z.string().optional().describe('ODSQL where clause, e.g. "commune = \'Saint-Denis\' AND annee > 2020"'),
      select: z.string().optional().describe('Comma-separated list of fields to return (defaults to all)'),
      order_by: z.string().optional().describe('ODSQL order_by clause, e.g. "date DESC"'),
      limit: z.number().int().min(1).max(100).default(20),
    },
    async ({ dataset_id, where, select, order_by, limit }) => {
      try {
        const data = await client.getRecords<RecordObject>(dataset_id, {
          where,
          select,
          order_by,
          limit,
        });
        return jsonResult({ total_count: data.total_count, results: data.results });
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : 'Failed to query dataset');
      }
    }
  );
}
