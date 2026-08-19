# Civic analysis prompt recipes

## Public services by commune

Prompt:

```text
Build a civic profile for Saint-Benoît: public administrations, schools,
health facilities, priority neighborhoods, elected officials, and associations.
Give me concise findings and mention data gaps.
```

Expected tool flow:

- `reunion_commune_profile`
- `reunion_search_admin_directory`
- `reunion_search_health_professionals`
- `reunion_search_local_elected_officials`
- `reunion_search_associations`

## Public procurement scan

Prompt:

```text
Look for recent public procurement notices in Réunion related to road works,
construction, or public buildings. Highlight recurring buyers and suspiciously
large amounts if the data supports it.
```

Expected tool flow:

- `reunion_search_boamp`
- `reunion_possession_search_procurement` for La Possession-specific contracts
- `reunion_search_sirene_establishments` for supplier context

