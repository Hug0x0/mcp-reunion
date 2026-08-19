import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeTelemetryRecord } from '../src/telemetry.js';

vi.mock('node:fs', () => ({
  appendFileSync: vi.fn(),
}));

const fs = await import('node:fs');

describe('writeTelemetryRecord', () => {
  afterEach(() => {
    delete process.env.MCP_REUNION_TELEMETRY;
    delete process.env.MCP_REUNION_TELEMETRY_PATH;
    vi.clearAllMocks();
  });

  it('does not write when telemetry is disabled', () => {
    writeTelemetryRecord({ tool: 'reunion_test' });
    expect(fs.appendFileSync).not.toHaveBeenCalled();
  });

  it('writes JSONL locally when telemetry is enabled', () => {
    process.env.MCP_REUNION_TELEMETRY = 'local';
    process.env.MCP_REUNION_TELEMETRY_PATH = 'usage.jsonl';

    writeTelemetryRecord({ tool: 'reunion_test', ok: true });

    expect(fs.appendFileSync).toHaveBeenCalledWith(
      'usage.jsonl',
      JSON.stringify({ tool: 'reunion_test', ok: true }) + '\n',
      'utf8'
    );
  });
});

