# Dagestan live verification — 2026-10-26

Cause: city-only parsing instructions produced null location for an explicitly named region; the search use case also only resolved cities. Context retained Dagestan correctly.

Fix: city or region place extraction, a generic local Admin 1 boundary adapter behind a port, polygon filtering after the bounding-box query, and no tool expansion outside an explicit region. Terrain criteria remain chosen by the model and grounded in tool measurements.

| Case | HTTP | Seconds | Results |
|---|---:|---:|---:|
| fresh | 200 | 21.64 | 20 |
| context | 200 | 17.83 | 20 |

Both responses retain Dagestan and resolve the mountain wish using elevation ≥1500 m AND sampled relief ≥200 m. All 20 hotels in each response lie within the polygon and have partial matches. First: 1932.3 m elevation, 518 m relief at radius 1000 m. Both calls inspected 231 eligible hotels and used measure_terrain then finish.

Database scope audit: 466 raw hotel points inside the rectangular extent, 328 inside the polygon; the search repository further excludes unnamed/id-named hotels and dormitories, leaving 231 candidates.

The original conversation now stores the corrected result; GET restores its cached snapshot. Top hotel card returns 200 with zero room records. All three top geographic references return 200; no missing IDs.

Initial harness postchecks incorrectly read key and GeoJSON coordinates instead of characteristic_key and the coordinate array. Both assertions were corrected and re-run against saved responses without another paid call. Fresh and context verifiers now pass.

Automated gates: 287 unit/contract/integration tests; Ruff check/format, mypy, import-linter. The region fix changes no frontend source. Before pushing, incoming landing updates were merged with the existing selected-hotel texture integration; the conflict resolution preserves the texture attribute and both translation keys.

Limits: only these two live inputs were checked; regional terrain selections over 500 candidates remain unverified. Generalized boundary data and ground elevations are approximate; room inventory remains incomplete. The 50-query baseline failures remain documented separately.


Merge/deployment: a6c63f9 is the regional search fix; c2f3e6a merges incoming frontend
through 545dd54 with the texture branch. Both backend and frontend images were built and
recreated. Main health returns 200. Frontend verify passes 36 rules, 320 tests,
typecheck, Biome and build; existing PostCSS and chunk-size warnings remain.
Eight browser checks restore the actual user chat, select the Хидиб hotel and display
the map at 375/1440 px, RU/EN, light/dark. Zero JavaScript exceptions, zero horizontal
overflow and zero POST chat/model calls during restoration; screenshots for 1440 light RU
and 375 dark RU were inspected. The map's existing terrain appearance is outside this fix.

Context compaction moved detailed prior facts into session-state-2026-10-26-regions.md;
all explicit user instructions remain verbatim. No completed product facts were discarded.
