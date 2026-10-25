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

Automated gates: 287 unit/contract/integration tests; Ruff check/format, mypy, import-linter. No frontend files changed and no new browser claim is made. Existing frontend image retains the texture merge.

Limits: only these two live inputs were checked; regional terrain selections over 500 candidates remain unverified. Generalized boundary data and ground elevations are approximate; room inventory remains incomplete. The 50-query baseline failures remain documented separately.
