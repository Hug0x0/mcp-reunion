import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { client } from '../src/client.js';
import { registerGeographyTools } from '../src/modules/geography.js';

// Regression guard: OpenDataSoft v2.1 wraps some text fields as single-element
// arrays (com_name → ["Saint-Denis"]). The fix lives in pickValue. If anyone
// reverts that, list_communes (and friends) silently start emitting empty
// strings for every name field — caught by this test.

interface CapturedTool {
  schema: unknown;
  handler: (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }>;
}

class FakeMcpServer {
  tools = new Map<string, CapturedTool>();
  tool(name: string, _desc: string, schema: unknown, handler: CapturedTool['handler']): void {
    this.tools.set(name, { schema, handler });
  }
}

describe('row-mapping unwraps ODS v2.1 single-element arrays', () => {
  let server: FakeMcpServer;
  let spy: ReturnType<typeof vi.spyOn<typeof client, 'getRecords'>>;

  beforeEach(() => {
    server = new FakeMcpServer();
    registerGeographyTools(server as unknown as McpServer);
    spy = vi.spyOn(client, 'getRecords').mockResolvedValue({
      total_count: 1,
      results: [
        {
          // Every textual field is wrapped, mirroring real ODS v2.1 behavior.
          com_name: ['Saint-Denis'],
          com_code: ['97411'],
          com_current_code: ['97411'],
          epci_code: ['200030518'],
          epci_name: ['CINOR'],
          ze2020_name: ['La Réunion'],
          bv2022_name: ['Saint-Denis'],
          dep_name: ['La Réunion'],
          reg_name: ['La Réunion'],
          year: ['2024'],
        },
      ],
    } as never);
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it('list_communes emits scalar strings, not arrays, for name / code / EPCI fields', async () => {
    const tool = server.tools.get('reunion_list_communes');
    expect(tool).toBeDefined();
    const result = await tool!.handler({ limit: 1 });
    const payload = JSON.parse(result.content[0].text);
    const commune = payload.communes[0];
    expect(commune.name).toBe('Saint-Denis');
    expect(commune.insee_code).toBe('97411');
    expect(commune.epci_name).toBe('CINOR');
    expect(commune.region).toBe('La Réunion');
    // Ensure none of the picked values leaked through as an array.
    for (const value of Object.values(commune)) {
      expect(Array.isArray(value)).toBe(false);
    }
  });
});
