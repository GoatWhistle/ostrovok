# Ostrovok cards verification

26 October 2026, feat/hotel-agent-mvp / 8e229bc394d96a98212dbdd7613359783cbc3a8b.
User requested hotel API/site data immediately in cards: rates, rooms, services, status.

- Reused existing free Ostrovok lookup with identity verification. Added facilities, room_categories,
  photo_url to OpenAPI, application result and adapter. Metadata never bypasses matching.
- Shared stay context across list and details; automatically query first five list cards. More load
  when selected. No invented dates/occupancy, no LLM calls, no catalog persistence.
- Price means minimum returned stay total; category availability is distinct. Unknown facility codes
  omitted from localized display. Named room stays supplier RU text even in EN UI.
- Full backend unit/contract758 passed before enhanced metadata assertions; focused17 passed after.
  Ruff/mypy408/import3 passed. Integration16 passed with fakeLLM and no paid credentials.
- Frontend verify36guards/330tests/build passed. Earlier CSS token/classes failures fixed; final
  removal of misleading empty local rooms required deletion of unused roomsUnavailable translations.
- check-ui.mjs exercised real API and existing saved conversation, eight width/theme/language cases.
  Second bounded visual pass waits for photo decode. ui-results.json and screenshots contain evidence.
- live.json contains full three-hotel results including negative Riviera identity result.
- Built backend/frontend tag window-surface-20261026 and recreated services. Existing free mode and
  openai_compat LLM preserved. No model/indexing calls, no commits/push, no unrelated files reverted.
- Limits: no all-room guarantee, no floor/facade or booking guarantee; metadata requires dated lookup.
  Agent search latency is outside this change; prices load independently after results are available.
