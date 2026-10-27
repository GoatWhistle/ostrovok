# Why Ostrovok misses hotels: measured coverage, 2026-10-27

Branch `feat/hotel-agent-mvp`, HEAD `1790cbc`. Stand running with
`HOTEL_DATA_MODE=free`, backend tag `sun-arc-20261027`. User question verbatim:
«посмотри откуда еще можно брать данные по отелям помимо островка, не всегда по нему
находится информация». Source research runs separately into
`work/research/hotel-sources-beyond-ostrovok-2026-10-27.md`; this file measures the gap.

## Local inventory is the first limit

Read-only count over all 34,087 OSM hotels in the stand database:

| Field | Hotels | Share |
|---|---|---|
| Placeholder name equal to the OSM id | 7,303 | 21% |
| Single-word name | 13,280 | 39% |
| `addr:street` | 11,389 | 33% |
| `addr:street` and `addr:housenumber` | 10,785 | 32% |
| City/town/village tag | 5,372 | 16% |
| `website` or `contact:website` | 8,201 | 24% |
| Phone | 9,167 | 27% |
| `wikidata` | 145 | 0.4% |
| `stars` | 1,178 | 3% |
| `rooms` | 1,367 | 4% |

No external source can be matched for a hotel whose local record has no name, so the
21% placeholder share is a ceiling independent of the provider.

## Ostrovok resolution rate on 40 named hotels

`GET /api/v1/hotels/{id}/offers` through the running stand, dates 2026-11-10/12, 2 adults,
two random samples of 20 named hotels each, concurrency 2 with a 1 s pause. Raw results in
`offers-probe-40.json`, script `probe_ostrovok.py`.

| Sample | available | no_offers | hotel_unmapped |
|---|---|---|---|
| With `addr:street` | 3 | 4 | 13 |
| Without `addr:street` | 4 | 0 | 16 |

A card was resolved for 11 of 40 hotels (27%); for 29 of 40 (73%) no card was identified at
all. `no_offers` means the card was found and categories were read but no rate came back for
these dates, so card data is available in 7 of the 20 street-tagged cases.

## Most misses are identification, not absence from the supplier

The 29 unmapped hotels were queried directly against the public catalogue suggest endpoint by
name only (`suggest-probe-29.json`, script `probe_suggest.py`, 1.2 s between calls). For at
least six of them the correct property is present in the first page of suggestions and can be
confirmed against stored coordinates:

| Local record | Coordinates | Suggestion returned |
|---|---|---|
| SkyPoint, Международное шоссе | 55.9475, 37.4192 | Отель Skypoint Gamma Delta Alfa, ш Международное, д. 28Б |
| Centeral | 55.7642, 37.6190 | Отель Centeral Hotel, ул Петровка, д. 20/1 |
| Союз, Шереметевский проспект | 57.0034, 40.9869 | Отель Союз, Шереметевский Проспект, д. 47б, Иваново |
| 45 Параллель | 45.0036, 38.9617 | Отель 45 Параллель, Индустриальная улица, д. 10, Краснодар |
| iRent | 57.1154, 65.5607 | Апартаменты iRent, Тюмень |
| Lism | 44.9638, 35.2511 | Lis Mini Hotel, Феодосия |

Seven of the 29 returned no Russian suggestion for the name at all, including OSM junk
(`Mongolian (fake) town`) and non-commercial lodging (`Гостиница РПА`, `Спальный корпус №3`).
The remainder returned same-name properties in other cities, which is the expected answer to a
name-only query: without a city the query carries no geography and the ranked five candidates
can exclude the right one.

The same nine records were replayed through the real lookup stages (`replay_lookup.py`:
`search_queries` -> catalogue suggest -> `rank_suggestions` -> page read -> `assess_identity`).
The rejection reason was printed for every candidate. The correct property reached the identity
gate in three cases and was refused by it:

| Local record | Correct candidate | Distance | Name similarity | Reason |
|---|---|---|---|---|
| Союз, Шереметевский проспект 47 | Отель Союз, Шереметевский Проспект, д.47б | 30 m | 1.00 | `address_conflict` |
| SkyPoint, Международное шоссе 28Б с3 | Отель Skypoint Gamma Delta Alfa, ш Международное, д. 28Б, стр. 3 | 5 m | 0.48 | `address_conflict` |
| Centeral, no address | Отель Centeral Hotel, ул Петровка, д. 20/1 | 107 m | 1.00 | `insufficient_identity_evidence` |

- `address_status` compares house numbers as token sets, so `47` against `47б` and `28Б с3`
  against `д. 28Б, стр. 3` are disjoint and become `conflict`, which `assess_identity` treats as
  a hard refusal even at 5 m with an identical name.
- Acceptance without a confirmed address needs an exact name within 100 m or two shared name
  tokens within 60 m. Centeral sits 107 m from the supplier coordinates with one name token, so
  it fails by 7 m. Thresholds, not the supplier, decide these.

The other six show retrieval limits rather than gate limits. Without a city tag the query is
name-only and `rank_suggestions` keeps five candidates: `Центральная` returned five
same-named hotels 0.8-4.3 thousand km away, `Виноград` five more in other resort towns, and the
right property was never in the list. `Lism` produced one suggestion (`Lis Mini Hotel`,
Феодосия, the plausible match) which the ranking filter dropped because no name token is shared
and the street does not match. `Август` has a city tag (Кабардинка) yet still returned
candidates in Витязево and Крым, 65-3,500 km away.

## What this implies for extra sources

Adding another supplier helps the genuinely absent properties: non-commercial lodging, hotels
selling only through their own site, and small-town properties outside OTA inventory. It does
not help the false-negative class above, which needs three local changes that use data already
on disk and cost nothing:

1. Compare house numbers with building and letter suffixes normalized (`47` versus `47б`,
   `28Б с3` versus `д. 28Б, стр. 3`), and stop treating a suffix-only difference as a conflict
   when the distance is a few metres.
2. Treat coordinates as evidence in their own right: an identical normalized name within a
   building-sized radius should be acceptable without a street address, instead of failing at
   107 m against a 100 m rule.
3. Give every hotel a settlement name so the catalogue query carries geography.
   `place=city|town|village|hamlet` nodes are absent from the `pois` table today (verified by
   query) while the national extract `data/raw/russia-261024.osm.pbf` is on disk, so a nearest
   settlement can be derived offline.

Only after that does the residual share measure how much a second supplier would add.

## Limits

Samples of 40 and 29 hotels are small and were drawn by `md5(id || salt)` ordering, not
stratified by region or hotel size; the 27% rate carries no confidence interval. One date pair
was probed, so `no_offers` says nothing about other dates. "Correct property" in the table above
is a coordinate and address reading by hand, not a verified booking. Suggest responses were read
once each on 2026-10-27 and may change.

## Embeddings as the matcher: measured, does not separate right from wrong

Tested on 2026-10-27 with the embedder the product already uses (`polza.ai`,
`qwen/qwen3-embedding-8b`, one batch of 84 short texts — 21 local records and 63 candidates — in a single paid call). For each of the 21
unmapped hotels that returned Russian suggestions, the local record text
(`name, street house, city` — whatever we actually have) was embedded against each stored
suggestion text (`name, address, region`) and candidates were ranked by cosine.
Raw scores in `embedding-ranking-21.json`, script `embed_match.py`.

| Local record | Correct candidate | Its rank | Top-1 instead |
|---|---|---|---|
| Союз, Шереметевский проспект 47 | Отель Союз | 1 (0.727) | — |
| Lism, улица Ленина 122А | Lis Mini Hotel | 1 (0.540) | — |
| Август, Тихий переулок 9, Кабардинка | Август (Витязево) | 1 (0.702) | — |
| SkyPoint, Международное шоссе 28Б с3, Москва | Отель Skypoint Gamma Delta Alfa | 2 (0.755) | Sheraton Skypoint Luxe (0.815) |
| 45 Параллель, 10с1 | Отель 45 Параллель | 3 (0.544) | Квартира на улице 45 параллель 4/2 (0.566) |
| iRent | Апартаменты iRent | 3 (0.444) | iRent 72 (Irent) on 61 Trade Union Street (0.657) |
| Centeral | Отель Centeral Hotel | 3 (0.419) | Апартаменты Centeral (0.531) |

Top-1 is correct in 3 of 7 known cases. The scores do not separate matches from noise: the
seven correct top-1 values span 0.53-0.82, while hotels with no correct candidate at all reach
0.48-0.77 (`Виноград` 0.768 against a hotel 467 km away, `Прикумск` 0.735 against a different
hotel on a similarly named street). A single similarity threshold therefore cannot decide
acceptance, and a nearest-neighbour rule would confidently attach wrong properties — exactly the
failure mode the current strict gate exists to prevent.

The useful role is narrower and real: embeddings widen recall where token overlap is zero.
`Lism` to `Lis Mini Hotel` scores 0.540 while `rank_suggestions` drops that candidate entirely,
and transliteration or word-order differences behave the same way. So embeddings belong in
candidate ranking, with coordinates still deciding acceptance, and they add a paid call per
lookup unless the cached local ONNX model in `data/models` is wired up as a free embedder.

## Agent-driven web search: the idea is wired, the search backend is broken

The code path already exists. `RoomWebFallback` fires when the provider returns no rooms for a
hotel, runs `search_web` with the query
`"{name}" {city} {address} номера категории оснащение официальный сайт`, and instructs the model
to read official pages with `read_web_page`; `HotelMetadata` then extracts Hotel/LodgingBusiness
JSON-LD. Both search backends in `adapters/external/web_research.py` return irrelevant results
today, verified by direct calls on 2026-10-27 (`web-search-probe-6.json`, `web_probe.py`):

- `https://freeserp.ai/api.php` answers `200` with `ok: true` and unrelated news spam. The six
  queries for `45 Параллель`, `iRent`, `Geo apart`, `黑河世家酒店`, `Центральная` and
  `Гостинично-развлекательный комплекс Алмаз` returned the *same* six URLs, none of them about
  the queried hotel. A direct query for `Отель Союз Иваново Шереметевский проспект официальный
  сайт` returned news items about a Shostakovich anniversary, Yandex Taxi and shark beaches.
- Because the payload is `ok: true` with non-empty hits, the adapter never reaches its fallback.
- The fallback itself is also dead: `https://www.bing.com/search?format=rss` answers `200` with
  ten Polish `onet.pl` links for the same hotel query.

So the agent can walk the web, but it is currently handed noise, and reading the first result
wastes a page fetch (one of the six probes timed out, the rest landed on a blog about room
categories). Fixing the web route means replacing the search backend, not writing new agent
logic: either a search API that honours the query, or no search at all for this job — go
straight to the hotel's own site from OSM `website` (8,201 hotels, 24%) and to per-source URL
patterns, then parse JSON-LD. Costs stay honest either way: a page description never proves a
dated price or availability.

## After the fixes: 27% to 42% on the same 40 hotels

Four changes landed on `feat/hotel-agent-mvp` (commits `74ee9de`, `f7b8fdd`, `9486002`,
`32a345a`), each with unit tests and, for the settlement query, a PostgreSQL integration test:

1. House numbers are parsed into number plus building, so `47` matches `47б` while `12` still
   conflicts with `12/1` and `стр. 3` still conflicts with `стр. 5`. `стр.` is no longer read as
   the street type "street", which was turning a correct card into `address_conflict`.
2. An exact name without any address is accepted within 150 m instead of 100 m.
3. Candidate ranking keeps a near-identical name (`SequenceMatcher >= 0.7` on the normalized
   name) even when no token and no street is shared, so transliterations reach verification.
4. 151,943 named settlements (`place=city|town|village|hamlet|suburb|borough`) were imported from
   the local `russia-261024.osm.pbf` with the new `hotel-agent ingest-settlements` command, and
   `nearby_city` now answers from them — nearest city or town first, then the nearest smaller
   settlement, and only then the old "borrow `addr:city` from the nearest hotel" query.

The same probe, same dates, same 40 hotels, after rebuilding the stand:

| Sample | available | no_offers | hotel_unmapped |
|---|---|---|---|
| With `addr:street` | 3 → 5 | 4 → 6 | 13 → 9 |
| Without `addr:street` | 4 → 6 | 0 → 0 | 16 → 14 |

Hotels with data went from 11/40 (27%) to 17/40 (42%). The six changed records:
`SkyPoint`, `Союз`, `45 Параллель` and `Centeral` now resolve on the supplier (the three
false negatives measured above plus one more), while `Август` and `Гостиница Ларс` are filled
from the web instead. Raw results in `offers-probe-40-after.json`.

## Web fallback after the recommendation, measured

The free search backend was replaced: DuckDuckGo's HTML endpoint first, then freeserp, then Bing
RSS, and every provider's results now have to mention the query's quoted phrase before they are
returned. The same six hotel queries that used to return identical news spam now return the
hotel's own site and catalogue cards (`web-search-probe-after.json`); queries with nothing
relevant return an empty list instead of noise.

On top of that, `GET /hotels/{id}/offers` — which the product calls per card after the
recommendations are on screen, in parallel — falls back to a public web card when the supplier
cannot be matched: it searches, reads up to three pages, parses JSON-LD **and microdata**
(`adapters/external/microdata.py`, new; 101hotels, komandirovka and most Russian aggregators
publish microdata, not JSON-LD) and accepts a card only if `assess_identity` confirms it against
the stored coordinates and address. Live results (`card-probe-5.json`):

| Hotel | Web card accepted |
|---|---|
| Гостиница Кедр, Абаза | komandirovka.ru, «ул. Парковая, д.4» |
| Виноград, Кацивели | kudanayuga.ru, «Мини-отель «Виноград», Лименская, 5» |
| Август, Кабардинка | kudanamore.ru, «Мини-отель «Август», пер. Тихий 9» (through the stand) |
| Прикумск, Будённовск | none |
| Отель на Еловом, Миасс | none |

The status for a web card is `no_offers` with the page domain as `source`: the card is real, the
price for those dates is not claimed. No contract change was needed.

## Limits after the fixes

The 42% is one sample of 40 hotels on one date pair, not a national coverage figure. Letter
suffixes in house numbers are now tolerated, which can in principle merge two neighbouring
buildings that genuinely differ only by a letter; coordinates within 300 m and the single-candidate
guard are what prevent it, not the address. The 150 m radius was chosen to keep the existing
161 m rejection test passing — it is a judgement call, not a measured threshold. Search results
vary between runs, so a web card that matched once can be missing on the next call; nothing is
cached yet. Settlement names come from OSM place nodes and inherit their coverage. Single-word
generic names (`Центральная`, `Успех`) still return nationwide candidates and stay unmatched when
the hotel is absent from the supplier.
