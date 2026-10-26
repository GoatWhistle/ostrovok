## Current state

- Branch `feat/hotel-agent-mvp`, HEAD/origin `77b2570`; active task: slow map, fact 404, geographic inference, web/weather/sun tools. Main :8080 rebuilt with initial fixes; 20 new requests all HTTP 200, semantic failures being corrected. Work: `work/evals/map-fact-geography-plan.md` and `map-geo-research-results.json`.
- 34 087 hotels / 34 532 embedded documents, Qwen3 4096D complete; no reindex needed. Room inventory: 15 hotels / 89 categories. Old detailed state: `work/session-before-research-tools-2026-10-26.md`.
- New dynamic facts persist; restored 1089 old nearby/spatial/facility facts from saved snapshots. Actual lake fact now HTTP 200. Parent DEM cache with Docker volume, 2 prefetch workers; old measured warm startup is not comparable to new cold startup.

## Next actions and pitfalls

- Finish geo resolution via Wikidata coordinates + admin polygons, weather metric schema, room questions and external evidence. Run gates, targeted live checks, update docs, commit/push. Goal remains active until validated.
- Sources do not prove window view, current weather does not prove distant-future weather; missing inventory is unknown. Preserve protected quotes verbatim; SESSION may exceed its target.

