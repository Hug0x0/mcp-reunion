# Release process

Use the **Release** GitHub Actions workflow when publishing a new version.

Required setup:

- Repository secret `NPM_TOKEN` with publish rights for `mcp-reunion`
- GitHub Actions permissions enabled for writing contents
- MCP Registry publish remains handled by `.github/workflows/publish-mcp.yml` when the `v*` tag is pushed

Workflow behavior:

1. Validates the semver input.
2. Runs install, build, unit tests, schema checks, audit, and `npm pack --dry-run`.
3. Updates `package.json`, `package-lock.json`, and `server.json`.
4. Commits `chore: release vX.Y.Z`.
5. Creates tag `vX.Y.Z`.
6. Publishes to npm when `publish_npm` is enabled.
7. Pushes the commit and tag.
8. Creates a GitHub Release.

The tag push triggers the MCP Registry publishing workflow.

