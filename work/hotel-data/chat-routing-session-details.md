# Session entries promoted on 2026-10-26

## Free tools, 2026-10-26

- `feat/hotel-agent-mvp`, HEAD `8e229bc`: search_events/read_event_page, observe_wildlife, measure_landcover wired into DataExplorer/schema/main; MET Norway selected for agent and HTTP weather. Source URLs, quotes, venue points and date/scope checks flow to facts. Free data mode retained; existing LLM configuration unchanged, no model calls or stand restarts.
- Ruff/format, mypy333, import3 and585 unit/contract passed; frontend verify passed (324 tests and build). Source-credit UI: 8 viewport/theme/locale cases passed; preview stopped/deleted. MET live succeeded, GBIF filtered empty, WorldCover retry succeeded after transient error. KudaGo live success unverified (prior403).
- Integration8 passed/1 failed: concurrent geography code requires missing `geography_coverage` in local DB. Do not claim e2e verified; stand migration not applied. [Evidence, commands, failed checks](../work/hotel-data/free-tools-verification.md), [source limits](../docs/free-tools.md). Prior instructions preserved in session-before-free-tools.
- Next: deploy/restart only on the user's direction; recheck geography migration/e2e and KudaGo reachability. No paid model/indexing checks without manual request. Window-view goal remains incomplete. Protected instructions exceed SESSION budget; preserve verbatim.

- 2026-10-26: explained current search pipeline from code on feat/hotel-agent-mvp / 8e229bc: chat context → parsed wishes/geography → candidates → bounded tool exploration → evidence → deterministic ranking → saved snapshot/map. Read-only runtime inspection; no LLM calls or stand changes. New free tools remain code-wired pending deployment.



## Chat intent routing, 2026-10-26

- feat/hotel-agent-mvp / 8e229bc: ChatDialogue routes consult/hotel/search before SearchHotels. Shared cloud protocol and deterministic fallback; selected-hotel replies use bounded GetHotelCard facts/inventory with sources and current clock. Consultations preserve search query/snapshot and map focus. History loading never starts search. Routing failures clarify without searching.
- HTTP adds nullable search_message_id; snapshot stores _chat_message_id, existing nullable DB columns reused (no migration). Search/viewport nullability documented. Frontend types generated from canonical YAML, labels changed to general chat; controls stay on search reply.
- Passed:630 unit/contract,11 PostgreSQL integration,328 frontend tests, Ruff/format/mypy350/import3 and frontend verify. [Plan/failures/limits](../work/hotel-data/chat-routing-plan.md), [product behavior](../docs/chat-dialogue.md). No live model calls or stand restart by this task; cloud semantic quality and deployed chat behavior unverified. Prior concurrent deployment/geography tasks preserved. Protected instructions exceed SESSION target; preserve verbatim.
