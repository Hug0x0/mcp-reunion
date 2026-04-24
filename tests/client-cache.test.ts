import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReunionClient } from '../src/client.js';

describe('ReunionClient in-memory cache', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let client: ReunionClient;

  beforeEach(() => {
    client = new ReunionClient();
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ total_count: 42, results: [{ ok: true }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('caches referential datasets across repeat calls with the same params', async () => {
    const params = { where: 'year = 2022', limit: 10 };
    await client.getRecords('communes-millesime-france', params);
    await client.getRecords('communes-millesime-france', params);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT cross-cache between different params on the same referential dataset', async () => {
    await client.getRecords('communes-millesime-france', { limit: 10 });
    await client.getRecords('communes-millesime-france', { limit: 20 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('does NOT cache non-referential datasets (SIRENE, DVF, etc.)', async () => {
    await client.getRecords('base-sirene-v3-lareunion', { limit: 1 });
    await client.getRecords('base-sirene-v3-lareunion', { limit: 1 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('clearCaches() forces the next referential call to hit the network again', async () => {
    await client.getRecords('iris-millesime-france', { limit: 5 });
    await client.getRecords('iris-millesime-france', { limit: 5 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    client.clearCaches();
    await client.getRecords('iris-millesime-france', { limit: 5 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
