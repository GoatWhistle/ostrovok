# Open-ended search verification — 2026-10-26

Index: all 34,087 hotel records, 34,206 source documents, 34,532 chunks, 4096 dimensions;
15,995 unique texts. Content-addressed cache avoids repeating complete paid batches. The
238,393,388-byte compressed index passed full source-hash, coverage, finiteness and norm checks.
No credentials in artifacts. Full provider metadata retained for 15 hotels / 89 room categories.

The first 20-message main-stand run is a baseline, not a universal recommendation accuracy
measurement: 18 HTTP 200; 17 passed the predeclared geography/API checks. The failures were
an underwater false positive from a street name, one model 503 and the zoo 504. Some other
case checks only establish geography and API health, not all semantic modifiers.

The underwater context run incorrectly used literal «подводн» from «улица Подводников».
Saved source records reproduce it; the new unit regression fails on archived fc0c774 and
passes on the current implementation. Text matches now require a separate source entailment
check and an exact quote. Unsupported evidence remains unknown. Quote text is retained with
the fact. No cached bad-underwater result is promoted to stored facts.

Targeted main-stand replays: fresh/context underwater, hammam positive control and conference
request passed. Zoo still failed on the first targeted run; its nearby SQL repeatedly searched
large spatial neighborhoods. Materializing the tag-filtered candidate set once preserves the
same radius semantics. Direct repository check: 1.9 s; final main HTTP replay: 6.95 s, HTTP 200.
The provider transport also retries network/connection timeouts and disables hidden reasoning
for query parsing/context. These measures do not guarantee provider availability.

The user screenshot query «на берегу моря в Новороссийске с рестораном» incorrectly treated
missing inventory as absence, then a tool no-match as contradictory input. It also mapped
qualitative shoreline position to walking minutes. The current path measures straight-line
coast distance and queries arbitrary OSM objects inside each hotel's actual building. Named
conditions no longer require preset service fields. Soft preferences do not suppress all
recommendations; actual contradictory input still requires clarification.

Actual database audit: 49 candidate hotels, 49 coastline measurements, two hotels with restaurant
objects inside their building. Капиталъ w711007670: 138.7 m from the coastline; restaurant
n6684194394 inside its building. Альянс: 9842 m from the coastline. The agent returns Капиталъ
first with two partial, grounded matches. Ownership and room/service terms are unconfirmed.
Two live replays of the screenshot query passed (30.63 s and 21.81 s). The model chose 150 m
and 300 m qualitative thresholds in different runs; both are estimates and both include it.

All coastline and restaurant map refs returned 200. Derived facts are now saved transactionally
for returned hotels, so their source-detail endpoints also return 200 after restoration.
The prior ephemeral-only path returned 404 when opening these details. Fact labels now come
from the user's extracted wish; query filter dictionaries stay out of product explanations.

Backend gates: 301 unit/contract/integration, Ruff check/format, mypy, import-linter. Frontend:
36 rules, 320 tests, typecheck, Biome and build. Latest frontend through 5330c04 was merged and
started as requested, before continuing search fixes; tiny source-title fallback follows it.
Eight browser cases at 375/1440, RU/EN, light/dark passed with no JS errors or overflow. Final
restaurant source-detail browser checks passed at 375/1440 px: both source pages HTTP 200,
no JS errors, no overflow and no extra model calls; both screenshots inspected. Existing PostCSS/chunk warnings
and upstream Mapterhorn 404s remain known; no claim of terrain-image improvement is made here.

Limits: the catalog covers Russia, not all hotels worldwide; most hotels lack full room inventory.
Similarity is candidate relevance, not proof. Entailment can still be wrong; matches remain partial.
This is not a rerun of the previous 50-case baseline and does not close all of its failures.
