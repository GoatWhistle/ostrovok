# Session before event-source research

## Current state

- `feat/hotel-agent-mvp`, HEAD `8e229bc`; earlier changes uncommitted. Additional free-source research complete, no new runtime/config edits. [Prioritized shortlist](../work/research/hotel-wish-sources-2026-10-26.md) links places/mobility, environment and weather/routing reports, primary sources and exclusions.
- Priorities: Overture Places, local routing, WorldCover, MET Norway, canopy, surface water, airports, open-license EV data. Not integrated. Anonymous WorldCover HEAD/one GBIF RU record checked; no coverage/accuracy evaluation. Links and diff checks passed; no product test rerun for research-only changes.
- Previous implementation/free-mode/511-test state and local tag counts preserved [here](../work/hotel-data/session-before-source-research.md). Stand/model not started; no paid/key/account calls.

## Next actions and pitfalls

- Do not implement research candidates merely because documented; first fix sample/metrics and test availability/license/RU coverage. User requests free sources; preserve no-start instruction.
- MET Norway allows free commercial use; Open-Meteo hosted free API is noncommercial. EOG programmatic access now paid; Protected Planet/Ookla/Transitland have restrictive terms. Follow exact report caveats.
- Copernicus GLO-30 is DSM, not bare ground: avoid double-counting canopy/buildings when developing view calculation. Window goal remains incomplete; preserve unrelated artifacts.
- Protected instructions exceed SESSION target; preserve verbatim.
