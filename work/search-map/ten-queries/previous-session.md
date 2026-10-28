## Current state

- Previous stand, unfinished independent work and deployment details are preserved in [session-before-map](../work/search-map/session-before-map.md). Active Compose hotel-agent on :8080/:8000 must stay untouched; do not start hotel-sochi on the shared DB volume.

## Search map work, 2026-10-28

- Working branch `feat/hotel-agent-mvp`, HEAD `cb07521`, adjacent `o-hack-sochi`. Task 1 complete in one commit: search waiting map, actual candidates/city, cancellation. Frontend verify passed (632 tests); backend ruff/mypy and 1114 unit/contract tests passed. See `work/search-map/validation.md` there. No push.
- Task 2 night map N0 partially measured. Day toy-town 13:00 actual getStyle: land #f1eadb, roadLight #ffffff; WCAG ratio 1.1977976615531343 < required 3. Spec simultaneously freezes daytime colors and requires threshold every hour. Asked whether road threshold applies only at night or daytime roads may change. Prompt explicitly requires asking before proceeding on unattainable threshold. Waiting for answer; no N1–N8 product changes, no second commit.
- Evidence and resume: `work/map-night/validation.md`, `progress.md`, `tools/capture-grid.cjs`, `tools/contrast-report.cjs`, partial `before/grid/`, night 13→22 `before/current/`. Grid is NOT complete. Own capture Chromium processes stopped. Dev Vite :5182 and FakeLLM API :18090 remain; active Compose untouched. Preserve all unrelated untracked files. Protected user instructions exceed SESSION budget and remain verbatim.

## Animation preview deployment, 2026-10-28

- User paused night-map implementation and requested the new frontend on the running stand. Deployed task 1 `cb07521` frontend and matching API to Compose `hotel-agent` on :8080/:8000; DB untouched. Both services healthy. Served index exactly matches local build and entry assets return 200; API through nginx reports ok. No paid search checks issued.
- Docker Hub nginx metadata lookup failed with TLS timeout. Frontend built successfully in local Node 24 container and packaged over existing local nginx runtime; backend built normally. No extra commit or push. Night-map road contrast decision accepted: preserve day, apply >=3 only at night. Task 2 stays paused until further instructions.

## Search tour revision deployed, 2026-10-28

- User requested street-scale smooth candidate flights, visible actual routes and immediate focus on the shortest eligible walk; otherwise highest available review rating. Implemented and deployed to hotel-agent :8080/:8000. DB unchanged. Both services healthy; served frontend index matches build, new SearchPreview class present in backend image.
- Task 1 remains ONE commit, amended unpublished `cb07521` to `9fb48bc` (`feat(frontend): show hotel search on the map`). No push, no task 2 commit. Only context memory and unrelated user artifacts remain uncommitted; screenshots/browser JSON untracked intentionally.
- Verification: Node24 npm verify (36 rules, typecheck/lint, 635 tests, build); backend ruff/mypy589 and 1118 unit/contract tests, then focused scenarios after route pruning. Browser1440 normal and375 reduced: no JS errors. Final real-PostGIS route run with test-only deterministic parsed bar condition:4.241574s, winner Моё море31.9m graph, same first result. No paid LLM checks. Evidence: work/search-map/tour/validation.md and api-evidence.json; screenshots beside them. SVG overlay checked mobile after it was added.
- Night map remains PAUSED by user. Resolved criterion: preserve day; road CR>=3 only at night. Resume N0–N8 only on further instruction. Review ratings focus is among returned highest-matching results with available provider details; missing ratings stay unknown. Preview focuses first positive nearby condition; other conditions still constrain eligibility.


## Search routing update 2026-10-28

Worktree `/home/ikhail_horokhorin/projects/o-hack-sochi`, branch `feat/hotel-agent-mvp`, base SHA `9fb48bc` (amend pending). Final instruction: proximity uses hotel-to-hotel tour; facts/pets/sunset use old AgentProgress. Fixed partial evidence cache, graph snapping, onsite semantics, generic/named geographic routing and early route ranking. Stand hotel-agent frontend/backend updated; no DB recreation. Frontend verify 644 passed; PostGIS integration 5 passed. See `work/search-map/route-review/validation.md` for live LLM findings and failures (dogs unconfirmed, sunset timed out; supplier parallelization only unit-verified). Night-map task stays paused; no push.


2026-10-28 active user instruction, verbatim: «посмтри как отработал последний запрос я нажал куда то и анимация отменилась пусть можно будет  двигать карту но анимация не прервется». Latest query: quiet nights + nearby bars, 20 partial matches. Camera now yields during a gesture and continues afterward; selecting a hotel does not cancel a running tour. Same search commit is amended again; no push.
