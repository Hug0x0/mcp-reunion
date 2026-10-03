import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataGouvTabularClient } from '../src/clients/data-gouv.js';

describe('DataGouvTabularClient', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let client: DataGouvTabularClient;

  beforeEach(() => {
    client = new DataGouvTabularClient();
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'content-type': 'application/json' } })
    );
  });
  afterEach(() => { fetchSpy.mockRestore(); });

  it('builds the URL with `<column>__exact=<value>` for each filter and URL-encodes accents/spaces', async () => {
    await client.query('abc-123', { filters: { 'Code département': '974' } });
    const url = (fetchSpy.mock.calls[0][0] as string).toString();
    expect(url).toContain('https://tabular-api.data.gouv.fr/api/resources/abc-123/data/');
    expect(url).toContain('Code+d%C3%A9partement__exact=974');
  });

  it('skips undefined / empty filters', async () => {
    await client.query('abc-123', {
      filters: { 'Code département': '974', 'Code circo': undefined, x: '' },
    });
    const url = (fetchSpy.mock.calls[0][0] as string).toString();
    expect(url).toContain('Code+d%C3%A9partement__exact=974');
    expect(url).not.toContain('Code+circo');
    expect(url).not.toContain('x__exact');
  });

  it('passes pageSize / page through', async () => {
    await client.query('abc-123', { pageSize: 50, page: 2 });
    const url = (fetchSpy.mock.calls[0][0] as string).toString();
    expect(url).toContain('page_size=50');
    expect(url).toContain('page=2');
  });

  it('passes contains filters using the tabular-api operator', async () => {
    await client.query('abc-123', { contains: { 'Code postal': '974' } });
    const url = (fetchSpy.mock.calls[0][0] as string).toString();
    expect(url).toContain('Code+postal__contains=974');
  });

  it('fetches every page when querying a complete filtered resource', async () => {
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: 1 }, { id: 2 }], meta: { total: 3 } }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [{ id: 3 }], meta: { total: 3 } }), { status: 200 })
      );

    const result = await client.queryAll<{ id: number }>('abc-123', {
      filters: { Departement: 'La Réunion' },
    });

    expect(result.data).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect((fetchSpy.mock.calls[1][0] as string).toString()).toContain('page=2');
  });

  it('fails instead of looping when pagination stops early', async () => {
    fetchSpy
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [], meta: { total: 1 } }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: [], meta: { total: 1 } }), { status: 200 })
      );

    await expect(client.queryAll('abc-123')).rejects.toThrow(/pagination stopped/);
  });

  it('throws with the response body when the API returns non-2xx', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('boom', { status: 500 })
    );
    await expect(client.query('abc-123')).rejects.toThrow(/tabular-api 500/);
  });
});
