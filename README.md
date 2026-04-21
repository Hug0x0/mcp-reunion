# mcp-reunion

[![license](https://img.shields.io/github/license/Hug0x0/mcp-reunion?style=flat)](https://github.com/Hug0x0/mcp-reunion/blob/main/LICENSE)

MCP server for [La Réunion](https://data.regionreunion.com/) public open data, exposed over `stdio` for Claude Desktop and other MCP clients.

## What it covers

Backed by the OpenDataSoft Explore v2.1 API at `data.regionreunion.com`. Currently **7 tools** across 3 modules:

- **Weather** (`donnees-synop-essentielles-ommpublic`) — Météo France SYNOP observations for Réunion stations: temperature, humidity, wind, pressure, rainfall; plus a station-listing tool.
- **Employment** (`demandeurs-d-emploi-…-a-la-reunion`) — Pôle emploi jobseeker counts by age/sex and by commune.
- **Transport** (`trafic-mja-rn-lareunion`, `rn-classement-fonctionnel-lareunion`, `voie-velo-regionale`) — national road traffic (TMJA), functional classification, and the regional cycle network.

The `data.regionreunion.com` catalog exposes ~270 datasets. More modules can be added incrementally — see *Extending* below.

## Install

```bash
npm install
npm run build
npm test
npm run dev
```

## Claude Desktop

```json
{
  "mcpServers": {
    "reunion": {
      "command": "npx",
      "args": ["mcp-reunion"]
    }
  }
}
```

## Extending

Each module lives in `src/modules/` and wires an OpenDataSoft dataset to one or more MCP tools via the shared `ReunionClient` (`src/client.ts`). To add a module:

1. Identify the dataset ID at `https://data.regionreunion.com/api/explore/v2.1/catalog/datasets?limit=100`.
2. Inspect its fields (`/catalog/datasets/<id>`) to know what to expose.
3. Write a module following the pattern in `src/modules/weather.ts` or `transport.ts`.
4. Register it in `src/modules/index.ts` and bump `TOOL_COUNT`.

## Production notes

- Runtime: Node.js 18+
- Transport: `stdio`
- Upstream API: `https://data.regionreunion.com/api/explore/v2.1`
- Authentication: none
- Language of source data: mostly French

## License

MIT — adapted from [lacausecrypto/mcp-new-caledonia](https://github.com/lacausecrypto/mcp-new-caledonia).
