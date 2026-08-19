#!/usr/bin/env node
// src/index.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAllTools, TOOL_COUNT } from './modules/index.js';
import { registerResources } from './resources.js';
import { installLocalTelemetry } from './telemetry.js';

/**
 * MCP Server for Réunion Open Data (data.regionreunion.com).
 *
 * Currently exposes:
 * - Météo France SYNOP weather observations
 * - Pôle emploi jobseeker statistics (by age/sex and by commune)
 * - National road traffic (TMJA), road classification, regional cycle network
 */
async function main(): Promise<void> {
  const server = new McpServer({
    name: 'mcp-reunion',
    version: '1.0.0',
  });

  installLocalTelemetry(server);
  registerAllTools(server);
  registerResources(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('MCP Réunion server started');
  console.error(`Tools registered: ${TOOL_COUNT}`);
  console.error('Resources registered: 5');
  console.error(`Local telemetry: ${process.env.MCP_REUNION_TELEMETRY === 'local' ? 'enabled' : 'disabled'}`);
  console.error('API: https://data.regionreunion.com/api/explore/v2.1');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
