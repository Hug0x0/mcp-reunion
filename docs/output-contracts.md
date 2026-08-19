# Output Contracts

All MCP tools return JSON in `content[0].text` for compatibility with clients that only read textual tool output.

Tools that use the shared `jsonResult()` helper also expose the same object through `structuredContent`, so MCP clients can consume typed fields without reparsing text.

## Common Success Shape

Most tools return an object with:

- `total_*` or `total_count`: upstream count for the query.
- A domain array such as `communes`, `schools`, `routes`, `results`, `perimeters`, or `contributions`.
- Curated scalar fields with English names and SI units where relevant, for example `surface_m2`, `distance_m`, `population`, `centroid.lat`, `centroid.lon`.

Generic catalog tools keep upstream fields under `results` because they intentionally expose arbitrary datasets.

## Common Error Shape

Errors are returned as:

```json
{
  "error": "Human-readable error message"
}
```

The result also sets `isError: true` and mirrors the object through `structuredContent`.

## Stability Rules

- Dedicated modules should return curated objects and avoid raw upstream records unless the dataset is intentionally generic.
- Large geometry fields such as `geo_shape` should be omitted unless a tool is explicitly designed for geometry export.
- New numeric fields should include units in their name when the unit is not obvious.
- New tools should use `jsonResult()` and `errorResult()` rather than constructing MCP responses manually.
