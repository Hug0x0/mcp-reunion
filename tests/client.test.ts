// tests/client.test.ts

import { describe, it, expect } from 'vitest';
import { ReunionClient } from '../src/client.js';

const client = new ReunionClient();

describe('ReunionClient', () => {
  it('fetches records from a Réunion dataset', async () => {
    const data = await client.getRecords('donnees-synop-essentielles-ommpublic', {
      where: "nom_reg = 'La Réunion'",
      limit: 3,
    });

    expect(data.total_count).toBeGreaterThan(0);
    expect(data.results.length).toBeGreaterThan(0);
    expect(data.results[0]).toHaveProperty('nom');
  });

  it('fetches dataset metadata from the catalog', async () => {
    const meta = await client.getDatasetMetadata('trafic-mja-rn-lareunion');
    expect(meta).toBeDefined();
    expect(meta?.dataset_id).toBe('trafic-mja-rn-lareunion');
    expect(Array.isArray(meta?.fields)).toBe(true);
  });

  it('lists catalog datasets with a where clause', async () => {
    const data = await client.listDatasets({
      where: "search('trafic')",
      limit: 5,
    });
    expect(data.total_count).toBeGreaterThan(0);
    expect(data.results.length).toBeGreaterThan(0);
    expect(data.results[0]).toHaveProperty('dataset_id');
  });

  it('applies WHERE filters', async () => {
    const data = await client.getRecords('trafic-mja-rn-lareunion', {
      where: 'tmja > 10000',
      limit: 5,
    });

    expect(data.results.length).toBeGreaterThan(0);
    data.results.forEach((row: any) => {
      expect(row.tmja).toBeGreaterThan(10000);
    });
  });
});
