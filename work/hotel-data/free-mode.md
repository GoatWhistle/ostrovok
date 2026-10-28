# Free hotel-data mode

Date: 2026-10-26. Branch `feat/hotel-agent-mvp`, HEAD `8e229bc`, changes uncommitted.
User instruction verbatim: «все должно быть бесплатно».

- HotelDataMode.FREE / HOTEL_DATA_MODE=free is the default and is set in local ignored .env.
  Nuitee/ETG keys no longer select runtime providers; catalog matcher and offers provider are
  absent. Manual sync-nuitee and match-nuitee commands fail before I/O in this mode.
- Existing partner adapters remain dormant behind explicit HOTEL_DATA_MODE=partner. No account
  actions, partner applications, keys/credentials requests, paid calls or API key validation.
- HotelMetadata extracts Hotel/LodgingBusiness JSON-LD locally without executing scripts or
  fetching remote contexts; public page reader exposes metadata as untrusted evidence.
  Existing identity/quote verification still applies. It does not invent room availability.
- Selected Claude and embedder configurations remain separate from hotel source policy;
  they were not run and no Compose/application restart occurred.
- Exact cost research: work/research/free-hotel-data-2026-10-26.md. Nuitee static/basic calls
  are published free under fair-use/look-to-book terms; do not call them categorically paid.
  Card-free unconditional production access is not confirmed. Other partner tariffs unknown.
- Public site reading is not an open license to republish descriptions/photos. No bypass,
  automated account usage or portal endpoint invention. FSA machine export unconfirmed.

## Verification

- Ruff check and formatting passed (311 files), mypy passed (305 source files).
- import-linter: 3 kept, 0 broken.
- HOTEL_DATA_MODE=free LLM_PROVIDER=fake with hotel API keys empty and DBMATE_BIN set to the
  temporary local dbmate binary: 511 unit/contract/integration tests passed, 11 dependency warnings.
- Documentation links and git diff whitespace check passed.
- Read-only PostGIS availability audit: all 34,087 hotels; 6,247 website/contact:website,
  11,389 street tags, 0 Wikidata tags. Raw method/date in free-source-counts.json;
  product evidence in docs/evidence.md. Links and metadata availability are unverified.
- Fixtures cover no paid credentials being attached by page reader, false amenity preservation,
  malformed/large JSON-LD and graph data, and suppression of partner providers despite keys.
- No new failing checks. Real HTML availability on hotel sites not established by these fixtures.

## Limits

Free hotel-source mode does not make the chosen cloud LLM/embedding services free. No local
replacement model was introduced because the active preceding request selected Claude and
prohibited its startup. This scope distinction is explicit in docs/hotel-data.md.
No free complete national inventory/live-price source has been established. OSM data coverage
and stored websites are separate from verified property/room information.
Previous state remains in session-before-free.md and existing provider/Anthropic/window notes.
