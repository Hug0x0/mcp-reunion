# Tourism prompt recipes

## Visitor and activity snapshot

Prompt:

```text
Create a tourism snapshot for Réunion: recent monthly frequentation,
family-friendly trails, hiking circuits, remarkable places, and classified accommodations.
```

Expected tool flow:

- `reunion_get_tourism_frequentation`
- `reunion_list_family_trails`
- `reunion_list_hiking_circuits`
- `reunion_list_landmarks`
- `reunion_search_classified_accommodations`

## Outdoor planning

Prompt:

```text
Find beginner-friendly outdoor activities around Saint-Paul or the west coast.
Prefer short trails, family walks, cultural points of interest, and accessible pools.
```

Expected tool flow:

- `reunion_list_family_trails`
- `reunion_list_hiking_circuits`
- `reunion_list_cultural_leisure_pois`
- `reunion_list_swimming_pools`

