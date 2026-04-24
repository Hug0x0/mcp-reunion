import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { client } from '../src/client.js';
import { registerTransportTools } from '../src/modules/transport.js';
import { registerTerritoryTools } from '../src/modules/territory.js';
import { registerAdministrationTools } from '../src/modules/administration.js';

// Minimal stand-in for McpServer that just captures tool registrations so
// each handler can be invoked directly with crafted args and its ODSQL
// query inspected via a spy on `client.getRecords`.
interface CapturedTool {
  schema: unknown;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

class FakeMcpServer {
  tools = new Map<string, CapturedTool>();
  tool(name: string, _desc: string, schema: unknown, handler: CapturedTool['handler']): void {
    this.tools.set(name, { schema, handler });
  }
}

function invoke(server: FakeMcpServer, toolName: string, args: Record<string, unknown>) {
  const tool = server.tools.get(toolName);
  if (!tool) throw new Error(`Tool not registered: ${toolName}`);
  return tool.handler(args);
}

describe('tool → ODSQL snapshot', () => {
  let server: FakeMcpServer;
  let spy: ReturnType<typeof vi.spyOn<typeof client, 'getRecords'>>;

  beforeEach(() => {
    server = new FakeMcpServer();
    registerTransportTools(server as unknown as McpServer);
    registerTerritoryTools(server as unknown as McpServer);
    registerAdministrationTools(server as unknown as McpServer);
    spy = vi.spyOn(client, 'getRecords').mockResolvedValue({
      total_count: 0,
      results: [],
    } as never);
  });

  afterEach(() => {
    spy.mockRestore();
  });

  describe('transport.reunion_search_road_accidents', () => {
    it('filters commune via com_name (regression guard for nom_com/com_name swap)', async () => {
      await invoke(server, 'reunion_search_road_accidents', {
        commune: 'Saint-Denis',
        limit: 5,
      });
      const [, params] = spy.mock.calls[0];
      expect(params?.where).toContain("com_name LIKE 'Saint-Denis%'");
      expect(params?.where ?? '').not.toContain('nom_com');
    });

    it('filters year and severity', async () => {
      await invoke(server, 'reunion_search_road_accidents', {
        year: 2019,
        severity: 2,
        limit: 5,
      });
      const [, params] = spy.mock.calls[0];
      expect(params?.where).toContain('an = 2019');
      expect(params?.where).toContain('grav = 2');
    });
  });

  describe('territory.reunion_search_real_estate_transactions', () => {
    it('converts year to a datemut date range (anneemut is stored as a date, not int)', async () => {
      await invoke(server, 'reunion_search_real_estate_transactions', {
        year: 2022,
        limit: 5,
      });
      const [, params] = spy.mock.calls[0];
      expect(params?.where).toContain("datemut >= date'2022-01-01'");
      expect(params?.where).toContain("datemut < date'2023-01-01'");
      expect(params?.where ?? '').not.toMatch(/\banneemut\s*=\s*\d+\b/);
    });

    it('stacks min/max value filters with AND', async () => {
      await invoke(server, 'reunion_search_real_estate_transactions', {
        min_value: 100000,
        max_value: 500000,
        limit: 1,
      });
      const [, params] = spy.mock.calls[0];
      expect(params?.where).toContain('valeurfonc >= 100000');
      expect(params?.where).toContain('valeurfonc <= 500000');
      expect(params?.where).toMatch(/AND/);
    });
  });

  describe('administration.reunion_search_baby_names', () => {
    it('uppercases the name prefix and quotes the year as a string', async () => {
      await invoke(server, 'reunion_search_baby_names', {
        name: 'lea',
        year: 2020,
        sex: '2',
        limit: 5,
      });
      const [, params] = spy.mock.calls[0];
      expect(params?.where).toContain("preusuel LIKE 'LEA%'");
      expect(params?.where).toContain("annais = '2020'");
      expect(params?.where).toContain("sexe = '2'");
    });
  });

  describe('escaping', () => {
    it("doubles embedded single quotes so commune names like L'Étang-Salé don't break ODSQL", async () => {
      await invoke(server, 'reunion_search_road_accidents', {
        commune: "L'Étang-Salé",
        limit: 1,
      });
      const [, params] = spy.mock.calls[0];
      expect(params?.where).toContain("L''Étang-Salé");
    });
  });
});
