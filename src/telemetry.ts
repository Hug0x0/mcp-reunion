// src/telemetry.ts

import { appendFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const DEFAULT_TELEMETRY_PATH = '.mcp-reunion-telemetry.jsonl';

type AnyFunction = (...args: any[]) => any;

function telemetryEnabled(): boolean {
  return process.env.MCP_REUNION_TELEMETRY === 'local';
}

function telemetryPath(): string {
  return process.env.MCP_REUNION_TELEMETRY_PATH || DEFAULT_TELEMETRY_PATH;
}

export function writeTelemetryRecord(record: Record<string, unknown>): void {
  if (!telemetryEnabled()) {
    return;
  }

  appendFileSync(telemetryPath(), `${JSON.stringify(record)}\n`, 'utf8');
}

function wrapCallback(toolName: string, callback: AnyFunction): AnyFunction {
  return async (...args: unknown[]) => {
    const startedAt = Date.now();
    try {
      const result = await callback(...args);
      writeTelemetryRecord({
        type: 'tool_call',
        tool: toolName,
        ok: true,
        duration_ms: Date.now() - startedAt,
        timestamp: new Date(startedAt).toISOString(),
      });
      return result;
    } catch (error) {
      writeTelemetryRecord({
        type: 'tool_call',
        tool: toolName,
        ok: false,
        duration_ms: Date.now() - startedAt,
        timestamp: new Date(startedAt).toISOString(),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}

export function installLocalTelemetry(server: McpServer): void {
  if (!telemetryEnabled()) {
    return;
  }

  const mutableServer = server as unknown as {
    tool: AnyFunction;
    registerTool: AnyFunction;
  };

  const originalTool = mutableServer.tool.bind(server);
  mutableServer.tool = (name: string, ...rest: unknown[]) => {
    const last = rest.at(-1);
    if (typeof last === 'function') {
      rest[rest.length - 1] = wrapCallback(name, last as AnyFunction);
    }
    return originalTool(name, ...rest);
  };

  const originalRegisterTool = mutableServer.registerTool.bind(server);
  mutableServer.registerTool = (name: string, config: unknown, callback: AnyFunction) =>
    originalRegisterTool(name, config, wrapCallback(name, callback));
}

