// src/modules/transport.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { client } from '../client.js';
import { errorResult, jsonResult } from '../utils/helpers.js';

const DATASET_TANEO = 'offre-de-transport-du-reseau-taneo';

export function registerTransportTools(server: McpServer): void {
  /**
   * Get Tanéo network info
   */
  server.tool(
    'nc_get_taneo_info',
    'Get information about the Tanéo public transport network serving Greater Nouméa (Nouméa, Dumbéa, Mont-Dore, Païta)',
    {},
    async () => {
      try {
        const metadata = await client.getDatasetMetadata(DATASET_TANEO);

        return jsonResult({
          network_name: 'Tanéo',
          operator: 'SMTU (Syndicat Mixte des Transports Urbains)',
          coverage: ['Nouméa', 'Dumbéa', 'Mont-Dore', 'Païta'],
          data_format: 'GTFS',
          note: 'GTFS files are available as attachments on the dataset page',
          dataset_url:
            'https://data.regionreunion.com/explore/dataset/offre-de-transport-du-reseau-taneo/',
          total_records: metadata?.metas?.default?.records_count ?? 0,
          has_records: metadata?.has_records ?? false,
        });
      } catch (error) {
        return errorResult(
          error instanceof Error ? error.message : 'Failed to fetch Tanéo info'
        );
      }
    }
  );
}
