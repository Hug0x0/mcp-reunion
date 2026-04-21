// tests/client.test.ts

import { describe, it, expect } from 'vitest';
import { ReunionClient } from '../src/client.js';

const client = new ReunionClient();

describe('ReunionClient', () => {
  it('should fetch public holidays', async () => {
    const data = await client.getRecords('jours-feries-en-nc', {
      limit: 5,
    });

    expect(data.total_count).toBeGreaterThan(0);
    expect(data.results).toHaveLength(5);
    expect(data.results[0]).toHaveProperty('jour_ferie');
    expect(data.results[0]).toHaveProperty('nom_jour_ferie');
  });

  it('should fetch companies', async () => {
    const data = await client.getRecords('entreprises-actives-au-ridet', {
      limit: 3,
    });

    expect(data.total_count).toBeGreaterThan(0);
    expect(data.results[0]).toHaveProperty('rid7');
    expect(data.results[0]).toHaveProperty('denomination');
  });

  it('should handle filters', async () => {
    const data = await client.getRecords('jours-feries-en-nc', {
      where: "jour_ferie >= '2026-01-01' AND jour_ferie <= '2026-12-31'",
      limit: 20,
    });

    expect(data.total_count).toBeGreaterThan(0);
    data.results.forEach((holiday: any) => {
      expect(holiday.jour_ferie).toMatch(/^2026-/);
    });
  });
});
