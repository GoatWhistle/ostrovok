# Detailed Russia geography — 2026-10-26

User instruction, verbatim: «скачай абсолютно все подробные данные для все России подобно Сочи, либо ходи в апишку, если локально данных нет».

Branch `feat/hotel-agent-mvp`, HEAD `8e229bc`; substantial pre-existing and concurrent work remains uncommitted. Preserve room/event/frontend changes from other sessions.

## Baseline and completed work

- Existing verified source: `data/raw/russia-261024.osm.pbf`, 3.9 GiB, existing MD5 and `.ok` marker.
- PostgreSQL baseline: 34,087 hotels (33,233 Russia + 854 Sochi), 1,701,414 buildings
  (1,595,433 Russia + 105,981 Sochi), 9,785,085 POIs, 8,951,260 walk edges,
  31,468 coastline features, 568,173 noise sources. Beaches: only 115 Sochi polygons.
- `uv run python scripts/refresh_osm_hotels.py --pbf ../data/raw/russia-261024.osm.pbf`
  completed: `updated_hotels=34087`. All raw tags merged by existing OSM ID; no paid indexing.
- Implemented `EnsureGeography`, `OverpassGeography`, `PostgresGeography`, coverage migration,
  scene/empty high-zoom tile/window-corridor hydration. Coverage and layers share a transaction;
  complete/empty responses persist 30 days, incomplete responses five minutes, failures are not empty data.
- Fixed isolated beach import to assemble OSM relations; full building import includes relations
  and `building:part`, keeps every tag and avoids attaching hotels to a building part.
- Full import uses a temporary sparse disk node index instead of retaining country nodes in RAM.
- Migration `20261026130000_geography_coverage.sql` applied successfully to the stand.
- Ruff/format/mypy/import checks passed. Combined unit/contract/integration run: 602 passed,
  11 dependency warnings. After additional metadata/disk-index assertions, nine targeted tests passed.
  External sessions are adding tests; record the final count after final checks.
- Public geography probes: main Overpass HTTP406, VK Maps HTTP504, Private.coffee timed out.
  Do not claim online geography download verified. Default endpoint is configurable Private.coffee,
  whose operator explicitly permits applications without registration; failed requests back off.
- `data/raw/russia.poly` downloaded from Geofabrik for registering actual extract coverage after a
  successful complete import. `register-import.py` requires a successful import-result.json;
  **do not register complete coverage before the importer exits successfully**.

## Ongoing operations

- Full `buildings beaches` import: exec session 30867, Python PID72392, uv PID72334.
  Command from backend: `uv run hotel-agent ingest-pbf --region russia --pbf ../data/raw/russia-261024.osm.pbf --layers buildings beaches --min-free-gib 20`.
  Latest observed progress: batch140, buildings699493, beaches507. These are processed counts,
  not counts of newly inserted buildings. Temporary index `data/raw/osm-nodes-uegxqltd` was9.0GiB.
- Two initial full-memory imports were interrupted before completion to reduce memory pressure;
  one committed100000 building updates. Imports are idempotent. Do not count these as completed.
- Homebrew osmium-tool installation: exec session67943. Optional acceleration: filter the verified
  PBF to buildings/parts/beaches with referenced nodes, then import the smaller verified derivative.
  Do not leave an abandoned process/index, and retain successful data already written.
- Backend image rebuilt in exec63686; another concurrent session deployed current shared code and
  offers/frontend. Check container/image identity before recreating; preserve free mode and Yandex.

## Remaining

- Finish full import or accelerate it, capture final processed counts and verify real layer counts.
- Register country extract coverage only after successful completion, then test local cached scenes
  across cities and repeated reads with no upstream calls. Check terrain API outside Sochi.
- Final appropriate backend checks, docs/evidence and context updates. Keep original source limits:
  complete OSM import does not supply missing room floors, availability, prices or true building heights.

## Updated operations

- Original full-PBF disk import30867 failed around batch160/799476 buildings when PostgreSQL
  was externally restarted at13:05UTC. Earlier committed batches survived. Temporary index removed.
- `prepare_geography.py` successfully made the930MiB reference-complete polygon derivative with
  **27507215 selected source objects**, preserving referenced nodes/relations and all tags.
  Source: same verified3.9GiB PBF. Homebrew osmium-tool attempt was interrupted during dependency
  downloads; the existing pyosmium BackReferenceWriter performs extraction without that dependency.
- First derivative import59302 was deliberately interrupted after at least batch200/3997208
  buildings and2792 beaches to switch to parallel database writers. Safe idempotent writes retained.
- New importer uses three isolated writer transactions and a bounded queue. Current job is the
  latest exec session returned for `--workers 3`; capture its ID separately after startup.
- Critical: do not restart the database during this import. Mark complete coverage only after
  successful final report. Backend image must be rebuilt with the current Compose TAG; current
  running image was `agent-loop-5b37603`, not `latest`. Hash comparison found geography usecase,
  DB adapter and Overpass adapter newer locally than the running image.
- Latest all checks: Ruff/format/mypy350 and3 import contracts;642 combined tests passed with
  12 dependency warnings. Ten concurrency/CLI tests passed after adding isolated polygon workers.

- Active import session6170, Python PID15982, `--workers 3 --batch-size 20000`; prior59302 stopped deliberately. Metadata/filtered-source commands finished. Last full check642 passed; later parallel and nationwide facade checks passed. `FootprintFacadeExtractor` now uses WGS84 Geod instead of Sochi UTM37, tested at five country locations. Still do not register full coverage until6170 succeeds.

## Full import succeeded

- Exec6170 exited0: `region=russia batches=1376 counts={beaches:17847, buildings:27488779}`. Report: `import-result.json`. Temporary1.9GiB node index removed automatically; do not restart this import.
- Prepared source audit array contains27507220 expected layer memberships; filtering selected27507215 raw objects (some belong to both layers). Coverage audit is running in65827, hotel materialization in74730, ANALYZE/count checks in23974. Complete country coverage is still pending source-gap handling.
- Latest combined backend check648 passed,12 dependency warnings; current stand image built as `hotel-agent-backend:agent-loop-stand-20261026b`, awaiting safe backend-only recreation after checks.

## Pinned stand correction

- Root-source backend was accidentally deployed over pinned window-location image. Detected newer
  deployment context afterwards. Root import/data remained intact; root and stand source branches
  were preserved. Overlapping model-evaluation results need an image/source audit before use.
- Restored original pinned backend tag from exact13bcbe8 (image54c1e7857cba); no frontend/DB changes.
- Isolated integration tree `/Users/savelij/projects/o-hack-geography-stand`, branch
  `fix/russia-geography-stand`, base13bcbe8, only18 geography/test overlays. Main, chat, search
  and all reviewer/agent modules remain byte-identical to the pinned base.
- Integration image `hotel-agent-backend:geography-20261026` built. Ruff/format/mypy369, three
  import contracts,665 combined unit/contract/integration tests passed,12 dependency warnings.
- Deploy using `docker compose -f docker-compose.yml -f work/geography/compose-runtime.yml up -d --no-deps backend`
  from the root. Root .env pin stays unchanged; ordinary Compose without override selects the
  restored original agent image. Do not overwrite shared pins with root-source builds.
