# Destination Route Libraries

These UMD modules implement the route-layer contract for destination quests. They do not register UI, service-worker entries or canonical payments.

## Modules

- `destination_route_core.js`
  - Browser global: `BurbzDestinationRouteCore`
  - Node export: `require('./destination_route_core.js')`
  - Main calls:
    - `planDestinationRoute(overpassJson, start, end, opts)` returns `{ok:true, route}` or `{ok:false, error}`.
    - `fetchDestinationRoute(start, end, opts)` derives a bounded Overpass POST body from the selected endpoints, fetches read-only public Overpass JSON with body-inclusive timeout/cancel handling, then calls `planDestinationRoute`.
    - `validateDestinationRoute(route)` reconstructs every vertex from saved provenance and rejects changed vertices, distance, fingerprint, type, direction and blocked/ineligible ways.
    - `buildDestinationOverpassQuery(start, end, opts)` is exposed for UI/provider inspection.

- `destination_elevation_core.js`
  - Browser global: `BurbzDestinationElevationCore`
  - Main call: `sampleRouteElevation(points, opts)` samples Mapterhorn Terrarium512 tiles at route-wide intervals.
  - True zero elevation/ascent is valid measured data. DEM network/decode/coverage failure returns `available:false` with an explicit reason.

- `destination_reward_core.js`
  - Browser global: `BurbzDestinationRewardCore`
  - Main call: `quoteDestinationReward(routeMetrics, elevation, opts)` returns the immutable preview/banked quote.
  - Actual state mutation and payment remain with the later canonical state/UI transaction owner.

## Constants And Rationale

- Route mode is `destination`, schema version `1`, kind `destination-route`.
- Supported route length is `25m..15000m`; selected endpoint air distance is bounded at `12000m`.
- Endpoint snapping is bounded to `45m` by default. The snapped route never draws or certifies the off-path connector.
- Overpass requests use public read-only endpoints and a bbox padded from the selected start and destination, not hardcoded ways.
- Pedestrian direction, supported via-node `restriction:foot` relations, access tags, barriers and complete node topology are checked before a route is certified.
- `routeEvidence.ways[].tags` and explicit `routeEvidence.nodes[]` provider-node records are the authoritative saved access/barrier provenance. `routeEvidence.segments[].access` is a denormalized descriptive copy for display/debugging and must not be used as the validator or eligibility authority.
- Elevation uses Mapterhorn Terrarium512 metres at max zoom 13, matching the existing map terrain provider without using rendered-map exaggeration.
- Unavailable elevation applies `NEUTRAL_ELEVATION_MULTIPLIER = 1`; it is not treated as measured flat ground.
- Rewards use existing coins, trainer XP and existing loot IDs only: `field_vole`, `wood_mouse`, `mealworm_scoop`, `garden_worms`, `sunflower_seeds`, `common_shrew`, `xp_scroll_minor`.
