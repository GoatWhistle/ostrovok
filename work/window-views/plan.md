# Window view search

Original objective: «надо чтобы определялись отели с конкретным выдом из окна по запросу. По рельефу, высоте отеля и соседний зданий, что рядом это место есть и ничего не перекрывает вид на это место. Протестируй на 50 разных запросах».

Status: active, 2026-10-26. Branch feat/hotel-agent-mvp, initial SHA a33afb9.

## Acceptance contract fixed before implementation

1. Parse the actual target, requested floors/heights and facade direction. Resolve the correct physical object and city/region. Ambiguous/missing location asks for clarification. A bus stop with the same name is not the landmark.
2. Candidate hotels use their real footprints, height/floors and available room metadata. The observer starts at a facade, not an arbitrary hotel centroid; requested opposite facade or impossible floor is rejected.
3. Check the whole observer-to-target path, including terrain, intervening buildings, target height/shape and long-distance curvature. An arbitrary 500 m ray or proximity is not visibility.
4. Return visible/blocked/unknown with the target, observer position/height, minimum viable floor, facade, distances, terrain coverage, building height sources, blockers and a reproducible sightline/profile. Unknown heights/coverage cannot become an unconditional clear view. Distinguish a geometric view estimate from a confirmed bookable room.
5. Rank by actual view computation. Persist evidence and geometry. Selecting/hovering the result shows the target, ray and blockers; source details explain the conclusion without raw internal keys.
6. Fifty fixed diverse real queries on the main stand. Validate semantics and evidence, not just HTTP 200. Include multiple cities, target types, heights/floors, facade directions, blocked/clear paths, unknown data and impossible/ambiguous requests. Save failures and re-run corrected cases. Independently test analytic geometry and reconstruct selected real rays against source data.
7. Appropriate backend/frontend gates, visible UI at 375/1440 in both themes/languages, Compose deployment, commit/push and current context. Do not mark the goal complete while any required item lacks evidence.

## Baseline evidence

`baseline-named-view.json`: Saint Isaac view returns distance-only spatial_distance@1 facts. The executable assertion failed: no line-of-sight evidence.

The target lookup selected a bus stop called «Исаакиевский собор» (n1459039680), rather than the cathedral relation r3229838. Distance was consequently wrong as well.

Russia: 33 233 hotels, 30 304 linked footprints, height_m/levels columns empty. Hotel building tags retain 796 explicit heights and 10 638 floor counts. Sochi: 854 hotels, 839 linked footprints/heights, 578 known level counts.

1 701 414 building footprints are stored, but only 214 relation footprints. The country building import only reconstructs closed ways. Cathedral relation r3229838 is absent as a building. Dataset completeness must be handled before claiming that a path is clear.

Public OSM relation/full endpoint returned 200 for r3229838 in 0.38 s (13 178 bytes). Tested Overpass endpoint returned 406. Do not assume Overpass is available.

## Implementation sequence

- Pure line-of-sight physics and analytic regressions: full path, interval obstructions, curvature, minimum observer height, explicit missing coverage.
- Source DTOs and a narrow window-view interface; physical target resolution, height provenance, facade observers and full-path building queries.
- Repair/on-demand retrieval of missing physical geometry and coverage, backed by real OSM data and caches. Preserve uncertainty and avoid fabricating rooms/windows.
- Search orchestration, ranking and persisted facts/geometries; typed parsed constraints and frontend explanation.
- Fix the 50-case corpus before the first new run, replay on main, inspect geometry independently, fix and re-run failures.

## Primary methods

- GDAL viewshed curvature/refraction convention: https://gdal.org/en/stable/programs/gdal_viewshed.html (visible light curvature coefficient 6/7).
- Current Shapely transform API: https://shapely.readthedocs.io/en/stable/reference/shapely.transform.html.

## Integration checkpoint, 2026-10-26

Search now invokes EvaluateWindowViews for both named and sea views. Window height and facade
constraints pass from the model into geometry, and Boolean/unknown evidence replaces numeric
proximity scoring. Dynamic facts and map features persist together. Frontend treats a sightline
as fact geometry rather than a walking route.

`first-real-evaluation.json`: local real PostGIS/OSM/DEM evaluation of three closest hotels to
Saint Isaac. Four Seasons recovers its relation footprint on demand and obtains a conditional
clear facade ray; the other two stay unknown due to missing coverage. First cold check 7.04 s,
after target-part correction and cached sources 1.64 s (n=1 each, different calculation; not a
performance comparison). Testing only the highest part initially rejected lines through other
parts of the same cathedral; candidates now include the nearest real known-height part.

Backend checkpoint: 364 tests passed before adding constraint/persistence regressions. Frontend
320 tests/36 rules, typecheck/lint/build passed before the final walking-route label adjustment.
This is not the 50-case main-stand verification; that remains required and not yet run.

## Round 1 on main :8080

All 50 queries executed against the same deployed version. Automatic evidence audit initially
passed 26/50, HTTP 200 49/50. Median 8.11 s, maximum 52.37 s (50 sequential requests,
2026-10-26). Across returned wishes: 31 visible, 158 unknown, 16 blocked. These are model
outputs, not verified real room views. Raw API responses, fact profiles and audits are in round1/.

Manual target inspection invalidated the apparent Elbrus pass: it selected a same-named resort
in Kislovodsk, not the mountain. The initial automatic checker was too weak about physical
identity; it now checks target tags and mountain distance as well. Do not report 26/50 as actual
semantic correctness.

Prepared corrections after this frozen run:
- prefer actually calculated view facts over unchecked alphabetical hotel names at equal scores;
- preserve and filter model-selected OSM object type, including the natural peak/volcano
  distinction and physical castle vs memorial; physical source type is checked again after
  coordinate fallback;
- north facade rounding must stay modulo 360 (red regression reproduced and fixed); the
  Teletskoye response logged InvalidValue and must be replayed to confirm the runtime correction;
- corridor coverage includes all cells crossed by every segment, including high latitudes;
  missing physical ways, as well as relations, retain incomplete coverage.

Eight real UI variants passed navigation/hover/fact loading/map geometry and overflow checks:
375/1440, light/dark, ru/en. Screenshots and report are in ui-*; the UI conversation is a real
backend result, not a mocked response. All eight matrix screenshots were visually inspected. Target cathedral is only a labelled
point in current map context, missing imported relation parts are not yet rendered as 3D proof.

## Merged checkpoint

Product commits 78aae9b and 9c2eb66; merged remote frontend/chat updates through 042c703
as 0c3732d. Chat-title migration applied. Post-merge backend gates: 400 tests and all static
checks passed. Frontend: 324 tests/36 rules, typecheck/lint/build passed. New merged UI still
needs a live verification pass; previous screenshots belong to pre-merge frontend.

corrections1 (7 real main queries, pre-merge): Isaac floor7, Hermitage, Neva and real Elbrus
passed the stronger automatic audit; Teletskoye returned HTTP200 but no geometric proof;
Ostankino did not resolve its official name variant; Kazan castle resolved correctly but the
profile exposed part tags rather than parent tags, causing an audit failure. The last two
are corrected locally: unique typed name-token variants and separate parent/part tags.
Ostankino local repository now resolves r3440930. These latest corrections need a main replay.

Remaining UI findings: actual cathedral parts absent from the 3D explanation; observer label
can overlap the selected hotel; EN generic fact explanation loses the visibility status.
Do not mistake passed overflow/navigation assertions for completion of these issues.

## Second full run and isolated follow-up

Round2: all 50 main-stand queries returned HTTP200; strengthened automatic audit passed 36/50.
Median 9.025 s, maximum 79.02 s, 50 sequential queries. This is evidence validation, not a
measured accuracy of actual room views. corrections2 re-ran the 14 failures after rare-term
name resolution: 9 passed, 5 remain (Hermitage, Kul-Sharif floor>=10, Samara floor2, Onega,
Nevyansk). These sets do not replace a final full run of the final implementation.

Main `feat/hotel-agent-mvp` through 8e229bc is pushed and deployed with updated frontend/chat
work, rare-term landmark resolution, the long chat-title overflow fix and EN visibility status.
402 backend tests and 324 frontend tests/36 rules passed. Merged UI matrix passed 8/8 hover,
fact, map and overflow checks; two latest captures inspected, six still need visual review.
PNG screenshots are ignored by repository policy and remain local artifacts. One original
pre-merge desktop RU PNG was overwritten by the first failed merged check; the failed merged
capture is preserved as ui-merged-overflow-1440-light-ru.png.

Concurrent Anthropic work appeared in the original root and owns its LLM/composition/config/docs
files and SESSION state. Do not revert/stage/deploy those unfinished edits as window-view work.
Window follow-up moved to `/Users/savelij/projects/o-hack-window-views`, branch
`fix/window-view-recommendations`, based on 8e229bc. Six uncommitted window-only patches were
copied there and reversed in the original root; unrelated changes were preserved.

Follow-up removes budget-skipped hotels from view recommendations and ranks specifically
attempted unknowns above unchecked hotels. Whole-object requests now retain calculated part
rays, but a clear sampled ray is UNKNOWN for the whole object and never claims complete view.
These follow-up changes pass 404 backend tests plus Ruff/format/mypy/import gates locally, not yet main-stand tested. Commit d16948d.

Next investigations:
- rank large water-body candidates by actual geometry/nearest boundary, not its remote centroid;
  current candidate budget is applied to centroid order (especially Samara/Volga);
- unresolved Onega and Nevyansk need actual source/city/candidate discovery; examine observed
  source tags and provider results rather than relaxing type checks or substituting a namesake;
- expose candidate data to the model or add a cached public geocoder fallback if local names
  cannot resolve an object/city (Wikidata often returns403); no new fallback implemented yet;
- source cathedral/nearby building parts still absent from the 3D proof on the map; observer
  marker can overlap the selected hotel; full-object visibility remains unverified;
- merge follow-up with the main branch while preserving concurrent Anthropic work, deploy and
  replay all 50 on final version; independently inspect real targets and source profiles.

## Shore candidate regression, integration branch

2026-10-26: `fix/stand-agent-integration` after a636442. Minimal real candidate-preparation
regression with 65 hotels and an elongated water polygon failed: a shore hotel roughly
110 m from water was unchecked after 64 hotels closer to the label centroid. Resolve each
unique physical target before ordering; order by the same target-point geometry used by
rays. Reuse resolved objects, preserving typed identity validation and unknown-data rules.
Regression now passes;19 focused geometry/source tests and634 backend unit tests pass,
Ruff and mypy pass. Not deployed yet; actual Samara replay and final50 remain pending.
This turn is progress (red/green authoritative regression and source change), not completion.

## Stand replay and cache regression

Shore ordering deployed as `window-shore-20261026` (source92e58f1); runtime file SHA256
05814f5be0fe8e11315c4498d310d9006539f3f61250937a0e583311bca15d2a equals local source.
Both services healthy. Two-case replay started in shore-replay/.
Live Isaac logs exposed geography_unavailable for cell30.305,59.93,30.31,59.935 while
/srv/cache/view-geometry/area-30.305000-59.930000-30.310000-59.935000.osm exists.
OSMViewGeometry.area immediately delegated to new geography context and bypassed its
previous disk/memory cache. A regression using the real XML parser failed (None instead
of cached PhysicalArea); cache-first ordering fixes it without treating missing coverage
as complete.635 unit tests pass; Ruff/mypy pass. Cache correction not yet deployed.

Cache fix429743a deployed as window-cache-20261026 (image
sha256:a85aed3924d48f1beb53421d5f19240fee2d22b7f420fa88e58cb86b6372942f).
Runtime osm_geometry SHA256ab9f39174933af3734ac0246f2db0314d760acf32fd8e2d8d21d9f08c35d0c3c
matches local. Both services healthy. shore-replay Isaac timed out180.14s; Samara was
manually cancelled for deploying the diagnosed correction and is explicitly not a pass.
cache-replay contains two premature502 probes before startup finished; cache-replay-ready
is the actual after-readiness replay (session77112). Logs now confirm native Isaac view
matched in one tool call; final response still pending at this checkpoint.
Harness corrections: cancelled runs cannot pass; derived wish keys now inspected by
provenance method instead of filtering only spatial: keys (agent relabels native facts).
The currently running ready replay loaded the old key filter; re-audit its saved responses
without extra model calls before interpreting its geometric-evidence verdict.

## Location-only wish regression

Ready replay Isaac still exceeded180s: logs show native view matched in one tool, then
11 extra steps researching «отель в Санкт-Петербурге». Schema now asks the model for
location_source_text; exact matches are removed from free wishes only when location_hint
exists. Two parser regressions cover dropping city-only and preserving location-unknown
wishes; centre and view remain.637 unit tests/Ruff/mypy pass. Not deployed at this checkpoint.
Samara native evidence remains unresolved and agent is researching additional sources;
current live run session77112 must be polled before restarting.

cache-replay-ready completed: both Isaac and Samara client ReadTimeout180s,0/2.
These remain failures. New full run uses900s observation timeout so slower full pipeline
responses can be inspected, not silently treated as absence of hotels. Latencies remain
reported and are not claimed fixed.50 cases and physical/semantic audit expectations
unchanged; cancellation explicitly fails. Runtime must be healthy before launching.

Full round3 started on source13bcbe8/window-location-20261026 after both services healthy
and proxy health200. Immutable run metadata in round3/run.json. Sequential50, timeout900s;
live exec session95830. Do not restart deployment while this frozen evaluation runs.
This continuation made progress (parser regression/fix, deployment, full-run start).
