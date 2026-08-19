# Transport prompt recipes

## Road traffic analysis

Prompt:

```text
Analyze road traffic on RN1 and RN2 in Réunion.
Highlight the busiest segments, heavy-vehicle share, speed limits, and daily flow if available.
```

Expected tool flow:

- `reunion_get_road_traffic`
- `reunion_get_road_daily_flow`
- `reunion_get_speed_limits`
- `reunion_get_road_classification`

## Transit discovery

Prompt:

```text
List Car Jaune routes and stops that could help someone understand public transport coverage.
Then explain the limitations of the current static GTFS data.
```

Expected tool flow:

- `reunion_list_car_jaune_routes`
- `reunion_search_car_jaune_stops`

