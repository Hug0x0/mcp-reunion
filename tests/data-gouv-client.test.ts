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

  it('throws with the response body when the API returns non-2xx', async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response('boom', { status: 500 })
    );
    await expect(client.query('abc-123')).rejects.toThrow(/tabular-api 500/);
  });
});
