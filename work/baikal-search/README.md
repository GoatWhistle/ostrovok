# Geographic object search, 2026-10-26

User request: «модель сама дожна попытаться определить город, по описанию запроса. Я захотел отель на берегу байкала, а агент спросил про город, так быть не должно».

Captured failing conversation: before.json. The parser explicitly required clarification
for objects spanning multiple regions. Candidate selection also used a50km circle
around a POI center; nearby evidence used distance to that center.

Implementation uses named natural objects as geographic scope. GeographicObjectsPort
wraps real OSM geometry; buffered full shape selects candidates, nearest boundary
provides straight-line distance and persisted map feature. Search buffer10km is an
engineering choice, not a verified universal travel area. No per-city hotel list.
Ambiguous object names are reviewed with actual administrative region derived from
local boundary polygons. Raw coordinates alone proved insufficient: an intermediate
review selected a different lake. The final review uses region evidence.

Local source r555716 has full Baikal multipolygon. Extracted reference-complete XML
from Russia PBF into shared view-geometry cache (15,003,623bytes). Live OSM full
response was200 and22,607,240bytes, larger than old12MB object cap; raised object-only
cap to32MB. Area requests retain12MB cap. Geometry/facts still use actual source data.
An exploratory Nominatim lookup identified the same relation; public Nominatim is
NOT added as an application dependency. Existing OSM attribution remains.

Isolated source /Users/savelij/projects/o-hack-geographic, branch
fix/geographic-object-search, base247ff82. Main image geographic-20261026 layers
only changed modules over exact previous runtime2b30cf65; unrelated component fix
in owner a065acb remains outside this deployment. Additive patch safely applied to
root and owner source, preserving unrelated work.

Staging HTTP checks: exact Baikal chat returned20 hotels on multiple shores;
Телецкое озеро search returned3 with requested limit3. check.py requires no city
clarification, nonempty results, contour-distance evidence and map references.
Before snapshot fails; after2.json and teletskoye.json pass. Checks are manual real
Yandex DeepSeek requests, not a broad geographic accuracy benchmark.

748 unit/contract tests and16 integration tests pass. Ruff, formatting, mypy403files,
three import contracts pass. Deprecation/dependency warnings remain. Initial new
fixture lacked region_id; fixed before green run. First staged request still failed
because several lakes share the full name; region evidence fixed this. Startup curl
was retried after health. Large-object parsing is cached; no latency claim.

Main deployment interrupts concurrent50-query evaluation; overlapping owner results
need runtime audit. Main-after.json records final main-proxy smoke. Main provider
remains DeepSeek/free data; image name does not imply Claude authorization success.

Final main :8080 exact chat:20 results, no city question, checker PASS. All20 persisted map distance lines returned by geo-features:batch. Health200; deployed image d19bd9dc. No new browser UI edits. Temporary staging container removed after checks.
