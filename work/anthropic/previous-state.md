# Session state before the Anthropic adapter

## Current state

- `feat/hotel-agent-mvp`, product `0c3732d`; view goal active, not complete. Search now computes facades/floors, whole-path DEM/buildings/curvature and persists map evidence. :8080 deployed; merged Compose refresh underway.
- Main fixed 50-case round1: 49 HTTP200, one500; initial audit 26/50 was too weak (Elbrus resort mistaken for mountain), not semantic accuracy. Sources/review: `work/window-views/plan.md`, raw `round1/`. Local type filter now resolves actual volcano/river/castle.
- 400 backend tests/gates, 324 frontend tests/36 rules/build passed after merge. Old UI verified; merged UI needs recheck. `work/window-views/ui-check.json`.

## Next actions and pitfalls

- Finish refresh, replay failures and all 50 with stronger identity audit; inspect remaining UI and source geometry; commit/push and update evidence. No goal completion yet. corrections1 passed 4/7; details in plan.
- Zero-score unchecked alphabetical hotels hid computed views: sorting deployed. North azimuth rounded to360: reproduced/fixed; Teletskoye now HTTP200, still lacks geometry proof.
- Unique typed name variants and parent tags corrected after first replays; full round2 required. EN generic explanation loses status; observer label can overlap hotel.
- Missing OSM relations/parts/heights remain unknown; cathedral parts not rendered in 3D proof. Whole-object panorama unsupported. Data read-only, cache `/srv/cache` writable.
- Preserve protected instructions despite SESSION target overflow.
