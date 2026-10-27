# Hotel rooms, photos and facts: make supplier lookup actually resolve

User: «У нас вроде бы как есть способ ходить и забрать инфу об номерах отелях. Об фотках, фактах
и тп, но сейчас это не работает … подосмтреть реализацию можно тут
https://github.com/LegacyTeam26/ostrovok».
27 October 2026, branch `feat/hotel-agent-mvp`, HEAD `f1472e7`.

## Live diagnosis, before any change

Stand `hotel-agent-backend:named-nearby-20261027`, 34087 local hotels, 15 supplier refs, 89 rooms.
`GET /api/v1/hotels/{id}/offers` returns `hotel_unmapped` for Жемчужина (`w51847420`, `w51847429`)
and Radisson Collection (`r7447995`); only `r12821037` (Богатырь) answers, from an old cache entry.

Probe `work/hotel-data/catalog-match/probe-*`: 9 hotels, three search variants each.

1. The `hotel_name` filter passed to `/hotel/search/v2/site/serp` is strict. It returned
   `total_av_hotels=0` for 6 of 9 probed hotels (Жемчужина ×2, Azimut ×2, Radisson, Cosmos Adler)
   while the same bbox without the filter returned the correct hotel. `LODGING_WORDS` also mangles
   names: `Radisson Collection Paradise Resort & Spa Sochi` becomes `Radisson Collection Paradise &`.
2. SERP pages hold 20 rows, not 60. `OstrovokSite.search` reads 3 pages and then raises
   `Incomplete hotel search` whenever `total_av_hotels > 60`, so any dense area fails.
3. `_address_status` reports `conflict` for equivalent addresses: OSM `улица Горького 56 с1`
   against site `улица Горького, д. 56с1` — the suffix becomes an extra numeric token.
4. Acceptance needs name similarity ≥ 0.9 when the address is confirmed.
   `Azimut Парк Отель Виноградная` vs `AZIMUT Парк Отель Виноградная Сочи 4*` is 0.857 at 62 m
   with a confirmed address, and was rejected.
5. The bbox SERP only lists hotels available for the requested dates (149 of 410 within 350 m of
   Жемчужина), so identity depends on availability. Жемчужина was absent from 80 scanned rows.

## What the site gives for free, verified by probe

`GET https://ostrovok.ru/api/site/multicomplete.json?query=<name>&language=ru&limit=20`
needs no key, no dates and no session: `master_id`, `otahotel_id`, `hotel_name`, `hotel_address`,
`region_name`, `country_code`, `slug`. `Жемчужина Черноморская` and `Жемчужина Сочи` both return
`7374217 / zhemchuzhina_hotel_complex / улица Черноморская, д.3 / Сочи`, which the bbox search
never found. Default page is 5 hotels, `limit=20` returns up to 19.

The hotel page `__NEXT_DATA__` for that id carries `location` (address, latitude, longitude, city,
pois with distances), `facts` (floorsNumber 19, roomsNumber 881, starRating, yearBuilt 1973,
yearRenovated 2007, kind, official `register` record with per-category room counts and a
tourism.fsa.gov.ru link), `images` (42, with categories), `roomGroups` (15, with photos, size,
bedding, amenities), `amenityGroups` (17 named groups, `isFree`), `descriptionStruct`, `rating`
(total, reviewsCount, detailed), `policies` (check-in/out, children, pets, parking), `contacts`.
`GET /hotel/search/v1/site/hp/search` with that `otahotel_id` and `region_id` returned 48 rates.

The reference repository searches Ostrovok by city `region_id` and shows its own results; it never
matches a local catalogue. Its useful detail: `static_vm.images` holds many photos, star ratings
come in tens, and pages are 20 rows.

## Plan

1. `adapters/external/ostrovok_catalog.py`: multicomplete client and pure parser with validated
   `master_id`, `otahotel_id` and `slug`; Russian hotels only.
2. `adapters/external/ostrovok_page.py`: parse the page `hotel` object into supplier details —
   photos, facts, official registry, amenity groups, description, nearby places, rating, policies,
   contacts, coordinates. Reuse `page_hotel` and `room_groups`.
3. `domain/hotel_identity.py`: compare house numbers by digit core, accept a confirmed address with
   a consistent name, and accept a fully covered multi-token name close by.
4. `adapters/external/ostrovok_site.py`: resolve identity through multicomplete queries built from
   name, street and city, verify candidates against their own page coordinates, then read rates by
   the resolved `otahotel_id`. Keep the bbox search as a fallback, without the name filter and with
   correct 20-row pagination.
5. `application/ports/supplier_details.py` plus `OfferLookup.details`, HTTP schema and
   `docs/api/openapi.yaml`.
6. Local city for query building: nearest `addr:city` from OSM through the search repository.
7. Agent: let `ProviderContent` read these details in free mode, so `provider_hotels` and
   `provider_rooms` stop reporting "not configured".
8. Frontend: photos, facts, amenities and nearby places in the hotel card.
9. Tests with `MockTransport`, contract check, docs, then a live run over the probed hotels.
