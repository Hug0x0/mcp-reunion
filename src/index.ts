#!/usr/bin/env node
// src/index.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAllTools, TOOL_COUNT } from './modules/index.js';

/**
 * MCP Server for Réunion Open Data
 *
 * Provides access to data.regionreunion.com datasets including:
 * - Public holidays
 * - Company registry (RIDET)
 * - Employment data
 * - Weather stations
 * - Mining and nickel production
 * - Environmental data
 * - Public facilities
 * - Population census
 * - Tourism (hiking trails)
 * - Public transport
 */
async function main(): Promise<void> {
  // Create MCP server
  const server = new McpServer({
    name: 'mcp-reunion',
    version: '1.0.0',
  });

  // Register all tools
  registerAllTools(server);

  // Create stdio transport
  const transport = new StdioServerTransport();

  // Connect and start
  await server.connect(transport);

  // Log startup (to stderr to not interfere with stdio protocol)
  console.error('MCP Réunion server started');
  console.error(`Tools registered: ${TOOL_COUNT}`);
  console.error('API: https://data.regionreunion.com/api/explore/v2.1');
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
