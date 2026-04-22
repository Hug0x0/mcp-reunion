# mcp-reunion

[![license](https://img.shields.io/github/license/Hug0x0/mcp-reunion?style=flat)](https://github.com/Hug0x0/mcp-reunion/blob/main/LICENSE)

MCP server for [La Réunion](https://data.regionreunion.com/) public open data, exposed over `stdio` for Claude Desktop and other MCP clients.

## What it covers

Backed by the OpenDataSoft Explore v2.1 API at `data.regionreunion.com`. Currently **52 tools** across 17 modules. A **catalog** module lets the client reach any of the ~270 datasets that aren't wired to a dedicated tool yet.

## Modules

- **Weather** (`donnees-synop-essentielles-ommpublic`) — Météo France SYNOP observations for Réunion stations: temperature, humidity, wind, pressure, rainfall; plus a station-listing tool.
- **Employment** (`demandeurs-d-emploi-…-a-la-reunion`) — Pôle emploi jobseeker counts by age/sex and by commune.
- **Transport** (`trafic-mja-rn-lareunion`, `rn-classement-fonctionnel-lareunion`, `voie-velo-regionale`, `donnees-gtfs-lareunion`) — national road traffic (TMJA), functional classification, regional cycle network, and Car Jaune GTFS stops.
- **Tourism** (`sentiers-marmailles-lareunion`, `bdcanyons-lareunion`, `lieux-remarquables-lareunion-wssoubik`) — family trails, canyoning routes, and SIT Soubik landmarks.
- **Environment** (`world-air-quality-openaq`) — OpenAQ air-quality measurements at Réunion stations.
- **Facilities** (`base-permanente-des-equipements-geolocalisee-la-reunion`, `equipements-sportifs`) — INSEE BPE facilities and the national sport-equipment inventory, filtered to Réunion.
- **Education** (`indices-de-position-sociale-dans-les-colleges-…`, `etablissements-labellises-generation-2024-…`, `cartographie-des-formations-parcoursup-…`) — middle-school IPS, Génération 2024 label, Parcoursup programs.
- **Health** (`annuaire-des-professionnels-de-santepublic`) — CNAM health-professional directory filtered to Réunion.
- **Telecom** (`sites-mobiles-5g-a-la-reunion`, `arcep_regions`) — 5G cell sites per operator and FttH deployment coverage.
- **Housing** (`logements-et-logements-sociaux-…`, `couts-et-surfaces-moyens-…`) — departmental housing atlas and social-housing costs.
- **Urbanism** (`base-permanente-des-plu-de-la-reunion`, `liste-des-permis-de-constuire-…`) — PLU zoning and non-residential building permits (Sitadel).
- **Possession** (`donnees-essentielles-marches-publics-…`, `subventions-attribuees-…`) — La Possession public procurement contracts and association grants.
- **Geography** (`ban-lareunion`, `bal-la-possession`, `communes-millesime-france`, `cantons-millesime-france`, `intercommunalites-millesime-france`, `iris-millesime-france`, `les-20-quartiers-villesaintdenis`) — BAN/BAL addresses and the official communes / cantons / EPCI / IRIS / Saint-Denis quarters reference layers.
- **Catalog** (meta) — `search_catalog`, `inspect_dataset`, `query_dataset`. Lets the agent discover and query any of the ~270 datasets not covered by a dedicated module, with a raw ODSQL `where` clause as escape hatch.

The `data.regionreunion.com` catalog exposes ~270 datasets. More modules can be added incrementally — see *Extending* below.

## Reaching datasets that aren't wired yet

The dedicated modules above cover the most-asked topics, but the portal has ~270 datasets in total. Instead of writing a new module for every long-tail question, the **catalog** module gives the MCP client three generic tools that together act as an escape hatch onto the whole portal:

1. **`reunion_search_catalog`** — keyword / theme / publisher search across all datasets. Returns dataset IDs, titles, descriptions, record counts.
2. **`reunion_inspect_dataset`** — given a dataset ID, returns its full schema (field names + types) so the agent knows what it can filter on.
3. **`reunion_query_dataset`** — fetches records from any dataset with a raw ODSQL `where` clause, `select`, `order_by`, `limit`.

Typical flow when the user asks about something no dedicated module covers (e.g. volcanology, elections, library attendance, …):

```
reunion_search_catalog({ query: "volcan" })
  → returns e.g. dataset_id "suivi-volcanologique-piton-fournaise"
reunion_inspect_dataset({ dataset_id: "suivi-volcanologique-piton-fournaise" })
  → returns fields like date, type_evenement, magnitude, profondeur…
reunion_query_dataset({
  dataset_id: "suivi-volcanologique-piton-fournaise",
  where: "type_evenement = 'éruption' AND date >= date'2023-01-01'",
  order_by: "date DESC",
  limit: 20
})
```

Net effect: the agent can answer questions backed by any of the ~270 datasets without anyone having to code a new module first. Datasets that turn out to be popular via `query_dataset` are candidates for being promoted into their own dedicated module with curated field names.

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
