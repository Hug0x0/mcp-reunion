# Claude Desktop prompt recipes

Use these prompts after installing the server in Claude Desktop:

```json
{
  "mcpServers": {
    "reunion": {
      "command": "npx",
      "args": ["-y", "mcp-reunion"]
    }
  }
}
```

## Commune overview

Prompt:

```text
Compare Saint-Denis, Saint-Pierre, and Le Tampon using the Réunion MCP.
Summarize population, schools, priority neighborhoods, businesses, and recent road accidents.
```

Expected tool flow:

- `reunion_compare_communes`
- optional follow-up with `reunion_commune_profile` for the commune that needs detail

## Dataset discovery

Prompt:

```text
Find datasets about volcanoes or volcanic monitoring in the Réunion open-data catalog,
inspect the best candidate, then show me the most recent records.
```

Expected tool flow:

- `reunion_search_catalog`
- `reunion_inspect_dataset`
- `reunion_query_dataset`

