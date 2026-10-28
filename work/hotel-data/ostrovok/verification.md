# Ostrovok website room offers, 2026-10-26

User: «сделай у нас так же» after inspecting LegacyTeam26/ostrovok.
Branch: feat/hotel-agent-mvp, initial HEAD 8e229bc394d96a98212dbdd7613359783cbc3a8b.

## Fixed manual smoke plan

- Five existing OSM hotels: Жемчужина (Сочи), Гельвеция (СПб), Метрополь (Москва), Астория (СПб), Ривьера (Казань).
- GET through the deployed frontend proxy, 2026-11-02 to 2026-11-04, two adults, residency ru.
- Record HTTP and provider status, elapsed time, source, checked_at, actual room name/meal/total and unknown fields. Never infer sold-out from a failed/empty search.
- Repeat the first request: same checked_at and same result must be served from the ten-minute cache.
- This is a smoke sample, not a coverage or matching-accuracy benchmark. No LLM/embedding calls or paid hotel API calls.
- Browser: existing saved Astoria conversation; choose its real hotel, enter stay details, verify offers and no-meal labels in RU/EN at 375/1440 and light/dark. Capture actual API responses and screenshots; no substituted responses.

## Implementation

- Free mode creates OstrovokHotelOffers behind HotelOfferSearchPort, independently of partner IDs/catalogs.
- Website JSON search limited to a 350 m bounding square and name filter; strict existing identity assessment, full filtered pagination, unique accepted candidate.
- Errors/incomplete search -> provider_error; zero/multiple matching hotels -> hotel_unmapped. No demo rates or hotel details.
- Original API schema retained. Source prices are stay totals; available_rooms and floor remain unknown when absent. Explicit allotment zero is filtered.
- Positive cache ten minutes, unmatched cache one minute, shared in-flight tasks, concurrency two, total timeout40s, max3 pages. Source client closes with app lifecycle.

## Checks and operational notes

- Initial frontend verify hit two lint errors in another task's temporary free-sources-preview.html; its owner removed the preview, rerun passed all36 guards/324 tests/build.
- Initial integration run:8 passed/3 failed, because current geography code needed unapplied geography_coverage migration. Reviewed additive migration20261026130000 and ran dbmate up; first command failed because sslmode was absent, retry with sslmode=disable succeeded (no pending migration output). Other task may have applied it concurrently. No destructive migration or seed run.
- Updated images with docker buildx bake backend frontend; recreate only these services; model selection remains Yandex DeepSeek and HOTEL_DATA_MODE=free.

- Initial five-hotel API smoke: three available (Сочи/СПб), two unmapped; repeat took0.009s with identical checked_at. Full responses preserved in initial-live-results.json.
- Diagnosis: Метрополь rejected because Театральный проезд vs Театральный пр-д. Added explicit street-type abbreviation equivalence and a regression that still rejects a different street type. Ривьера search returned six nearby apartments, none matching the hotel: correct abstention.
- Initial browser matrix: all8 cases passed. The mobile harness initially consumed an aborted intermediate checkout request; narrowed its response matcher to the final checkout date. No product workaround or substituted responses.
- Final source checks: Ruff, format, mypy337, unit+contract592 passed. Import-linter3 contracts passed before the last isolated street-type change. Integration11 passed after schema readiness. Frontend verify passed (36 guards,324 tests,build); Impeccable detector reported[].
- Build warnings: existing PostCSS from-option warning and bundle-size warning remain; not introduced by room-source changes.

## Final deployed results

- Both services rebuilt and healthy; frontend now serves index-B5VdFzBr.js. Source remains HOTEL_DATA_MODE=free with website enabled by default; Yandex DeepSeek model selection preserved.
- Final five-hotel smoke: four available, Ривьера unmatched (nearby apartments rejected); full final responses in live-results.json. Totals for two adults/2026-11-02…04: Жемчужина12000RUB, Гельвеция28620RUB, Метрополь74000RUB, Астория37400RUB. No prebook or all-Russia coverage claim. Cache repeat0.011s with same checked_at.
- Final browser matrix:8/8 actual API cases passed with no page errors or horizontal overflow. Screenshots include explicit whole-stay price and localized no-meal text. Inspected desktop RU/light and mobile EN/dark images directly.
- One final manual API run raced service readiness and hit a non-JSON proxy response; retried only after Compose --wait completed and proxy health was200. No application change required.
- No commits, paid model calls, indexing or partner calls in this task. Existing unrelated working-tree changes preserved.
