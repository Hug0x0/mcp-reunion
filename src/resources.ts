// src/resources.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { client } from './client.js';
import { RecordObject } from './types.js';
import { pickNumber, pickString, quote } from './utils/helpers.js';

function textResource(uri: string, data: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

const POPULAR_DATASETS = [
  'ban-lareunion',
  'communes-millesime-france',
  'population-francaise-communespublic',
  'base-sirene-v3-lareunion',
  'donnees-gtfs-lareunion',
  'trafic-mja-rn-lareunion',
  'adresse-et-geolocalisation-des-etablissements-d-enseignement-du-premier-et-secon',
  'annuaire-des-professionnels-de-santepublic',
  'demande-de-valeurs-foncierespublic',
  'world-air-quality-openaq',
];

export function registerResources(server: McpServer): void {
  server.registerResource(
    'reunion-communes',
    'reunion://communes',
    {
      title: 'Réunion communes',
      description: 'The 24 communes of La Réunion with INSEE code, EPCI, department, and region metadata.',
      mimeType: 'application/json',
    },
    async (uri) => {
      const data = await client.getRecords<RecordObject>('communes-millesime-france', {
        where: `dep_code = ${quote('974')}`,
        order_by: 'com_name ASC',
        limit: 100,
      });

      return textResource(uri.toString(), {
        source: 'data.regionreunion.com',
        dataset_id: 'communes-millesime-france',
        total: data.total_count,
        communes: data.results.map((row) => ({
          name: pickString(row, ['com_name']),
          insee_code: pickString(row, ['com_code']),
          epci_code: pickString(row, ['epci_code']),
          epci_name: pickString(row, ['epci_name']),
          department: pickString(row, ['dep_name']),
          region: pickString(row, ['reg_name']),
        })),
      });
    }
  );

  server.registerResource(
    'reunion-epci',
    'reunion://epci',
    {
      title: 'Réunion EPCIs',
      description: 'Intercommunal structures for La Réunion.',
      mimeType: 'application/json',
    },
    async (uri) => {
      const data = await client.getRecords<RecordObject>('intercommunalites-millesime-france', {
        where: `dep_code = ${quote('974')}`,
        order_by: 'epci_name ASC',
        limit: 50,
      });

      return textResource(uri.toString(), {
        source: 'data.regionreunion.com',
        dataset_id: 'intercommunalites-millesime-france',
        total: data.total_count,
        epci: data.results.map((row) => ({
          name: pickString(row, ['epci_name']),
          code: pickString(row, ['epci_code']),
          legal_form: pickString(row, ['epci_nature']),
          population: pickNumber(row, ['population']),
        })),
      });
    }
  );

  server.registerResource(
    'reunion-iris',
    'reunion://iris',
    {
      title: 'Réunion IRIS areas',
      description: 'INSEE IRIS statistical areas for La Réunion.',
      mimeType: 'application/json',
    },
    async (uri) => {
      const data = await client.getRecords<RecordObject>('iris-millesime-france', {
        where: `dep_code = ${quote('974')}`,
        order_by: 'com_name ASC, iris_name ASC',
        limit: 5000,
      });

      return textResource(uri.toString(), {
        source: 'data.regionreunion.com',
        dataset_id: 'iris-millesime-france',
        total: data.total_count,
        iris: data.results.map((row) => ({
          iris_code: pickString(row, ['iris_code']),
          iris_name: pickString(row, ['iris_name']),
          commune: pickString(row, ['com_name']),
          commune_code: pickString(row, ['com_code']),
        })),
      });
    }
  );

  server.registerResource(
    'reunion-datasets-catalog',
    'reunion://datasets/catalog',
    {
      title: 'Réunion open-data catalog',
      description: 'Catalog summary for data.regionreunion.com datasets.',
      mimeType: 'application/json',
    },
    async (uri) => {
      const data = await client.listDatasets({ limit: 100 });
      return textResource(uri.toString(), {
        source: 'data.regionreunion.com',
        returned: data.results.length,
        total: data.total_count,
        datasets: data.results.map((row) => {
          const metas = (row.metas?.default ?? {}) as RecordObject;
          return {
            dataset_id: row.dataset_id,
            title: metas.title,
            theme: metas.theme,
            publisher: metas.publisher,
            modified: metas.modified,
            records_count: metas.records_count,
          };
        }),
      });
    }
  );

  server.registerResource(
    'reunion-datasets-popular',
    'reunion://datasets/popular',
    {
      title: 'Popular Réunion datasets',
      description: 'Curated high-value datasets frequently used by mcp-reunion tools.',
      mimeType: 'application/json',
    },
    async (uri) => {
      const metadata = await Promise.all(
        POPULAR_DATASETS.map(async (datasetId) => {
          const meta = await client.getDatasetMetadata(datasetId);
          const metas = (meta?.metas?.default ?? {}) as RecordObject;
          return {
            dataset_id: datasetId,
            title: metas.title,
            theme: metas.theme,
            publisher: metas.publisher,
            records_count: metas.records_count,
            modified: metas.modified,
          };
        })
      );

      return textResource(uri.toString(), {
        source: 'data.regionreunion.com',
        datasets: metadata,
      });
    }
  );
}
