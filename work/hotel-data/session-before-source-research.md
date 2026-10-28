# Session before additional source research

## Current state

- `feat/hotel-agent-mvp`, HEAD `8e229bc`; all changes uncommitted. `HOTEL_DATA_MODE=free` now defaults and is set locally: Nuitee/ETG providers and manual match/sync disabled. JSON-LD hotel metadata added to public page reader as untrusted evidence. [Details](../work/hotel-data/free-mode.md), [free-source research](../work/research/free-hotel-data-2026-10-26.md).
- 511 tests including 9 PostgreSQL integrations passed; Ruff/format/mypy/import checks passed. No paid calls or stand restart. Claude/embeddings selection unchanged and not run; hotel-data mode does not make them free.
- Read-only local tags audit: 34,087 hotels; 6,247 website tags, 11,389 street tags, 0 Wikidata tags. [Method and limits](../docs/evidence.md#бесплатные-ссылки-на-сайты-в-локальном-osm). Website identity/availability unverified.

## Next actions and pitfalls

- Preserve no-start/no-provider-call instruction. Free sources do not guarantee all hotels, room inventory or live prices. [Guide](../docs/hotel-data.md).
- Prior provider/window/Anthropic state: [previous session](../work/hotel-data/session-before-free.md). Window goal incomplete; preserve pending artifacts.
- Protected instructions exceed SESSION target; preserve verbatim.
