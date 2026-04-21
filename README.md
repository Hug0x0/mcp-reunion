# mcp-reunion

[![license](https://img.shields.io/github/license/Hug0x0/mcp-reunion?style=flat)](https://github.com/Hug0x0/mcp-reunion/blob/main/LICENSE)

MCP server for [La Réunion](https://data.regionreunion.com/) public open data, exposed over `stdio` for Claude Desktop and other MCP clients.

> **Status: work in progress.** This repo was forked from [`mcp-new-caledonia`](https://github.com/lacausecrypto/mcp-new-caledonia) as a starting point. The HTTP client and module scaffolding are reusable (both portals run OpenDataSoft Explore v2.1), but every module currently points at **New Caledonia dataset IDs and field names** and needs to be re-wired to Réunion equivalents before anything actually works.

## Porting checklist

Each module under `src/modules/` references NC-specific datasets. For Réunion, they need to be mapped to local equivalents (or dropped if no equivalent exists):

- [ ] `administration` — public holidays, digital fragility
- [ ] `companies` — RIDET (NC-only) → SIRENE / local business registry
- [ ] `employment` — job offers, job seekers, civil servants
- [ ] `weather` — Météo stations, rain stations
- [ ] `mining` — **no equivalent** (NC-specific: nickel). Candidate replacement: volcanology / Piton de la Fournaise datasets.
- [ ] `environment` — water catchments, piezometers, reef stations
- [ ] `geography` — public facilities, vehicle statistics
- [ ] `population` — census, demographics, transport modes
- [ ] `tourism` — GR trails → GR R1/R2/R3 Réunion
- [ ] `transport` — Tanéo → Car Jaune / réseau régional Réunion

Useful portals to draw from:

- `https://data.regionreunion.com/` (Region Réunion, OpenDataSoft)
- `https://data.gouv.fr/` (national, filter on Réunion)
- `https://data.cerema.fr/` (national, some DOM coverage)

## Install

```bash
npm install
npm run build
npm test
npm run dev
```

## Claude Desktop (once modules are ported)

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

## Production Notes

- Runtime: Node.js 18+
- Transport: `stdio`
- Upstream API: `https://data.regionreunion.com/api/explore/v2.1`
- Authentication: none
- Language of source data: mostly French

## License

MIT — same as upstream. Credit to [lacausecrypto/mcp-new-caledonia](https://github.com/lacausecrypto/mcp-new-caledonia) for the original implementation.
