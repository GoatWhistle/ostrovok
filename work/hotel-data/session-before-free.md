# Session before free-only hotel data

## Current state

- `feat/hotel-agent-mvp`, HEAD `8e229bc`; provider matching and prior Anthropic work uncommitted. Nuitee lookup now checks name/address/coordinates and rechecks details before import; wired into offers, plus `match-nuitee` CLI. [Implementation/checks](../work/hotel-data/implementation.md), [provider research](../work/research/hotel-providers-russia-2026-10-26.md).
- 500 tests including 9 real PostgreSQL integrations passed; Ruff/format/mypy/import checks passed. No live provider calls, Compose restart or bulk sync. Local Claude config unchanged; do not start it.
- Earlier adapter and window-goal state: [previous session](../work/hotel-data/session-before-providers.md). Window goal remains incomplete; preserve pending artifacts.

## Next actions and pitfalls

- Coverage and matching accuracy need a separately authorized live evaluation. Yandex Travel/Bronevik/Ostrovok need partner access; no API with proven all-Russia completeness found. [Product guide](../docs/hotel-data.md).
- Address parser and thresholds are heuristic; negative cache/single-flight absent. Five pages max. Provider lookup/import has not run on the stand.
- Protected instructions exceed SESSION target; preserve verbatim.
