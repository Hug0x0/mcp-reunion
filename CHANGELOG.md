# Changelog

All notable changes to `mcp-reunion` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Glama integration: Dockerfile, `glama.json`, score badge in README — server is claimable and buildable on glama.ai.
- Enriched descriptions across all 96 tools in 21 modules: data sources, return-shape hints, cross-references to related tools, and `.describe()` on every parameter with concrete examples (boosts Glama tool-quality score).
- `CHANGELOG.md` and Dependabot config for npm and GitHub Actions.

## [1.4.0] - 2026-04-27

### Added
- Published to npm as `mcp-reunion@1.4.0` (`npx -y mcp-reunion`).
- `mcpName: io.github.Hug0x0/mcp-reunion` for the official MCP registry.

## [1.3.0] - 2026-04-25

### Added
- 2024 anticipated legislative elections (rounds 1 & 2) and 2024 European elections via `tabular-api.data.gouv.fr`, in a new `national-elections` module.

## [1.2.0] - 2026-04-25

### Added
- 2022 presidential round 1, 2022 legislative round 2, BOAMP procurement notices, water-management points.
- `reunion_compare_communes` (2-5 communes side-by-side) and `reunion_iris_profile` composite tools.
- `reunion_find_commune` fuzzy resolver (case- and accent-insensitive, abbreviation expansion).
- README sync: 96 tools across 21 modules.

## [1.1.0] - 2026-04-23

### Added
- 43 new tools across 7 new/extended modules: administration, economy, education, territory, transport, culture, environment, geography, health, social, tourism, facilities, hospitality.
- Cache layer for referential datasets (INSEE millésimés, QPV, etc.).
- `reunion_commune_profile` composite tool joining 8 datasets in parallel.
- Catalog escape-hatch (`reunion_search_catalog`, `reunion_inspect_dataset`, `reunion_query_dataset`) to query any of the ~270 datasets at data.regionreunion.com.
- Unit tests for helpers, cache behavior, and tool ODSQL generation.
- Weekly live smoke test against the upstream API.

## [1.0.0] - 2026-04-20

### Added
- Initial public release. MCP server for La Réunion open data exposed over `stdio`.

[Unreleased]: https://github.com/Hug0x0/mcp-reunion/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/Hug0x0/mcp-reunion/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/Hug0x0/mcp-reunion/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/Hug0x0/mcp-reunion/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Hug0x0/mcp-reunion/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Hug0x0/mcp-reunion/releases/tag/v1.0.0
