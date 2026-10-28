# Room galleries and full hotel rates

User: «надо показывать все, и даты и цены и какие номера есть по каждому отелю. Можно зайти на сам номер и посмотреть его, полистать фотки».
26 October 2026. Initial HEAD8e229bc, concurrent branch update to29888145fbf0cc5d7c1f07b435140b00f7e54323; branch remains feat/hotel-agent-mvp.

Implemented hp/search full rate response, public hotel page roomGroups, ID-scoped metadata and
rg_hash-only photo/rate linkage. Preserve all rate IDs; expose free cancellation deadline when explicit.
Fail full rates independently from page content; retain SERP fallback with rates_complete=false.
All list hotels now request rates, with two supplier lookups at a time. Input delay350ms prevents
intermediate edits from starting every lookup. Inline room detail, gallery arrows, photos count,
size/bedding/amenities, all category tariffs, back navigation with stay preservation.

Evidence:
- check-ui.mjs + ui-results.json: eight real API/browser variants, precise room photo1→photo2,
  return/back and shared dates. Astoria53 rates/14groups/99photos; selected category8photos.
- check-list.mjs + list-results.json:20requests/20responses;5available,15unmapped; all five have
  complete hotel-page rates and room catalogs. No claim that all local hotels can be matched.
- live.json final snapshot: Astoria full cached result; Zhemchuzhina/Riviera provider_error at15s.
  Earlier live run had Zhemchuzhina32rates/15groups/70photos. Do not hide final source errors.
- adapter-live.json is the initial diagnostic before string masterId correction (32rates,0groups).
  Raw website page JSON/JS and rate response retained under /tmp/ostrovok-hotel* and /tmp/ostrovok-hp-rates.json.
- Unit tests cover full rate variants, hotel ID mismatch, partial failures, strict photo hosts,
  string masterId and dotted region slug. Frontend tests cover photo bounds, absent and broken photos.
-763unit/contract,16integration, Ruff/format/mypy/import3; frontend336tests/36rules/build initially.
  Post concurrent merge frontend364tests/36rules/build passed. Detailed command outputs in /tmp/ostrovok-rooms-*.log.
- Schema split offer_schemas.py to keep file limits. API types generated from canonical YAML.
- First browser pass failed on Astoria0groups; fixed dotted slug and reran all8 successfully.
- Concurrent merge briefly left JSON/docs conflict markers; its owner resolved them before
  check-list rerun. Both rooms and place dictionaries preserved. This task did not stage or commit.
- Built/recreated backend/frontend using existing window-surface-20261026 tags, preserving LLM/free mode.
- Limits: undocumented source outages, identity abstention, no booking guarantee, no catalog without
  dates, unsupported amenity codes omitted. No room photos substituted with hotel or neighboring-room photos.

Final post-merge backend: Ruff passed, mypy447 passed,788unit/contract passed. Proxied health200.
