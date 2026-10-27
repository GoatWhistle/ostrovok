# Hotel rooms, photos and facts: implementation and verification

User: «У нас вроде бы как есть способ ходить и забрать инфу об номерах отелях. Об фотках, фактах
и тп, но сейчас это не работает … подосмтреть реализацию можно тут
https://github.com/LegacyTeam26/ostrovok».
27 October 2026, branch `feat/hotel-agent-mvp`, base `f1472e7`.

Diagnosis before any change: [plan.md](plan.md). The live probes behind every number below are in
`live-known9.json`, `live-sample25.json`, `live-sample40.json` and `live-card.json`.

## What was broken

The code existed and its tests passed, but on the stand almost nothing resolved. Identity was
established through a 350 m bounding-box search of `/hotel/search/v2/site/serp` with a
`hotel_name` filter:

1. The site's name filter is strict; it returned zero hotels for 6 of 9 probed hotels whose names
   were spelled differently in the catalogue, while the same box without the filter contained
   the right hotel.
2. Pages hold 20 rows, not 60. The reader took three pages and then failed with
   `Incomplete hotel search` for any area with more than 60 available hotels.
3. The box search only lists hotels available on the requested dates, so identity depended on
   availability. Жемчужина was absent from 80 scanned rows of 149.
4. `_address_status` called `улица Горького 56 с1` and `улица Горького, д. 56с1` a conflict.
5. A confirmed address needed name similarity above 0.9, which rejected
   `Azimut Парк Отель Виноградная` against `AZIMUT Парк Отель Виноградная Сочи 4*` at 62 m.

## What it does now

Identity comes from the catalogue, not the map. `GET /api/site/multicomplete.json` is free, needs
no key, no dates and no session. Queries are built from the OSM name plus street, plus city, plus
the bare name; the city falls back to the nearest hotel with `addr:city` within 25 km, which is a
database query, not a network call. All query variants run together and their candidates are
pooled, because the endpoint returns a different subset of rows for the same query on repeated
calls.

Up to five ranked candidates are then checked against their own hotel page
`/hotel/<slug>/mid<master_id>/<ota_id>/`: `__NEXT_DATA__` gives the coordinates and address that
decide the match. Exactly one accepted candidate is required. The page also carries everything the
user asked for: photos, room groups with photos, size, bedding and amenities, named amenity
groups, the structured description, nearby places with distances, the guest rating, check-in and
check-out times, contacts, and facts including floors, rooms, star rating, construction and
renovation years and the national accommodation register record with its `tourism.fsa.gov.ru`
link. Rates are a separate call to `/hotel/search/v1/site/hp/search` by the confirmed `ota_id`;
when it fails, the details and the room catalogue are still returned with `rates_complete: false`.

The box search is gone. It resolved nothing the catalogue path had not already resolved and
produced three false `provider_error` answers in a 25-hotel run.

Identity rules changed with it: house numbers are compared whole with `с1`/`стр1`/`к2` glued to
the number, площадь/бульвар/аллея/тупик/линия/тракт became address types, names split on hyphens
so `Karat-apart` meets `Карат Апарт`, lodging kinds such as «меблированные комнаты» and
«апарт-отель» are generic words, the candidate's own city is not identity evidence, and a shared
name word at a confirmed address is accepted only within 60 m.

The same details reach the agent without dates. `GetHotelDetails` feeds `ProviderContent`, so
`provider_hotels` and `provider_rooms` stop answering "Provider content is not configured" in free
mode and return facts, amenity groups, nearby distances and room categories.

## Live results

All runs hit the real site from this tree, with `check_in=2026-11-20`, `check_out=2026-11-23`,
`adults=2`, `residency=ru`.

The "before" column is the code at `f1472e7`, run from a temporary worktree against the same
hotels and the same stay, so both columns are measured, not recalled.

| Set | Before (`f1472e7`) | After |
|---|---|---|
| 9 hotels picked during diagnosis (`live-known9.json`) | 0 of 9 | 9 of 9 |
| 25 random hotels with a star rating (`live-sample25.json`) | 3 of 25, 3 `provider_error` | 10 of 25, no errors |
| 40 random named hotels (`live-sample40.json`) | 4 of 40, 7 `provider_error` | 9 of 40, no errors |

The stand answered one of those nine before the change only because a cached entry from the
previous day survived in the running process; the code itself resolves none of them.

The third row moved between 9 and 10 across two consecutive runs of the same code on the same
hotels. The hotel that moved is `338 Hotel` in Saint Petersburg: the catalogue returned its row
for one call and not for the next. The 25-hotel row gave 10 in both runs.

No false match appeared in any run. Every accepted hotel sat 1 to 67 m from the local point, and
in each case the supplier's street and house number matched the OpenStreetMap address. Misses are
abstentions, not wrong answers. The third set is random records of any kind, including holiday
bases, dormitories and guest houses the supplier does not list, so its ratio measures how much of
our local catalogue exists on the supplier side, not how well the matcher works.

## Checks that ran

Backend, from `backend/`: `uv run ruff check .`, `uv run ruff format --check .`, `uv run mypy .`
(485 files), `uv run lint-imports` (3 contracts kept), and
`LLM_PROVIDER=fake NUITEE_API_KEY= ETG_KEY_ID= ETG_API_KEY= uv run pytest tests/unit tests/contract`
— 892 passed. Integration tests were not run: this change adds no migration and touches storage
only through one new read query.

Frontend, from `frontend/`: `npm run verify` — 36 rule checks, 369 tests, typecheck, Biome and the
production build all pass. `schema.gen.ts` was regenerated from `docs/api/openapi.yaml`, not from
the running stand.

Stand: backend image `hotel-agent-backend:supplier-details-20261027c`, frontend image
`hotel-agent-frontend:supplier-details-20261027c`, both built from this tree and healthy.
`GET /api/v1/hotels/{id}/offers` was called over HTTP for four hotels that previously answered
`hotel_unmapped` and returned rooms, photos, facts, amenities, nearby places and rates for all
four. The agent tool was exercised in the container without any model call: `ProviderContent`
with `GetHotelDetails` returned `available` for two hotels, 2 hotel records and 29 room records.

Not done: a browser pass over the new card section at 375 and 1440 px in both themes and
languages. The hotel card is only reachable after an agent search, which is a paid model call,
and no explicit request for a paid check was given. The section is covered by four component
tests against a captured live payload instead (`live-card.json`).

## Limits

Recall equals the share of our OpenStreetMap records that exist in the supplier catalogue under a
recognisable name. On random records it is low because the local catalogue holds hostels, holiday
bases, dormitories and unnamed buildings that the supplier does not list at all. The numbers above
are not a measurement of coverage across Russia.

`/api/site/multicomplete.json` is undocumented and returns a different subset of rows for the same
query on repeated calls, so a hotel found in one minute can be missed in the next. Running the
query variants together and pooling their candidates reduces this but cannot remove it.

A hotel whose page the site redirects away from, for example a delisted one, cannot be read even
when the catalogue still suggests it. Several distinct hotels in one building are not separated
and give an abstention. Facts, amenities and nearby distances are what the supplier published: we
do not re-measure them on the map. Children are still absent from the offer contract. Booking and
prebook are not connected. The mapping is kept in memory only; nothing is written to
`hotel_supplier_refs` or `rooms` by this path.
