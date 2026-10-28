# Event discovery repair, 2026-10-26

Request: «мероприятия не ищутся. Если что то экзотическое, то агент должен ходить в интернет и там что то искать дополнительно и уже ориентируясь на эту инфу что-то предлагать. Так же унас есть афиша. Посмотри мой последний запрос».

Latest conversation c4327428-c987-4099-ad8d-4bb9a2108371: «хочу снять отель неподалеку от концерта Кишлака в Москве». Saved snapshot has zero results. Runtime logs show search_web, search_events, read_web_page followed by wish timeout after 23 tool calls. Logs do not contain complete tool responses, so exact historical arguments are unknown.

Reproduced two structural failures with `uv --directory backend run pytest tests/unit/application/test_event_discovery.py -q -n 0`: missing-date event discovery had no path to search; general page reading raised ValueError requiring hotel_id. Both failed before repair.

Changes:
- search_events without complete trip dates discovers public sources using query, city and current year. It does not infer stay dates or produce hotel facts.
- Dated KudaGo checks fall back to public web search on empty results/provider errors.
- read_web_page without hotel_id exposes text and Event metadata as context only, without adding hotel evidence. Explicit hotel association retains existing verification.
- read_event_page reads the source once and measures proximity for up to 500 selected candidates instead of four; dates, status and semantic evidence remain required.
- Empty successful primary search responses now try the secondary provider.
- Model instructions prioritize identifying events/places before iterating hotel records; multiple occurrences require clarification.

Validation: 798 unit/contract tests passed; mypy 450 files, ruff check, three import contracts passed. Final 14 focused tests passed after simplifying discovery query. Full format check found an unrelated concurrent edit in ostrovok_details.py; changed event files formatted separately. No storage/schema changes.

Manual free-source probe: `uv --directory backend run python ../work/event-search/probe.py`. Actual Yandex Afisha Event data for Kishlak exposed MTC Live Hall coordinates and date; read-only PostGIS query found eight nearest stored accommodations within 2 km (limited output, not total count). Artifact: live-probe.json. Event JSON-LD has midnight date marker; do not present it as the exact concert start time. Source: https://afisha.yandex.ru/moscow/concert/kishlak-2026-11 . No ticket or room availability verified.

Limitations: live LLM orchestration not replayed, running stand not restarted by this task. Sites without readable pages/structured venue coordinates remain unsupported for automatic distance evidence. Existing candidate geography remains the boundary. No guarantee of all event coverage. Snapshot and probe are diagnostics, not product seed data.


## Authorized deployment and live replay

User: «перезапусти и проаверь». On 2026-10-26 the backend was recreated from `hotel-agent-backend:event-discovery-20261026`, preserving the live `view-recovery-4191085` base and runtime environment. Seven event-related source files overlaid; frontend unchanged. Health is healthy, API returns status=ok, model remains Yandex DeepSeek, hotel data remains free. Nonsecret deployment override: deploy/compose.json. Temporary credential-containing environment snapshot removed. An unrelated ongoing evaluation may overlap this authorized restart; do not count interrupted evaluation requests as completed.

Exact replay of «хочу снять отель неподалеку от концерта Кишлака в Москве» via POST /api/v1/chat/messages completed in 214.2 seconds. Conversation c1c6f539-971f-4709-b76b-de528c8d6cde; zero results; answer: «Пока не могу подтвердить подходящие варианты по проверенным данным. Уточните условия поиска.» Artifacts: live-request.json, live-response.json, live-run.log.

**Live acceptance failed.** First wish `место проведения концерта Кишлака` performed search_events/read_web_page/read_event_page but timed out after 11 recorded calls. Second wish `рядом с местом проведения концерта Кишлака` used the same sources and finished needs_input after four calls. answer_scope rejected one claim as unsupported. Exact tool arguments/results are not logged, so a precise remaining cause is not established. Free sources and geometric evidence work independently; orchestration is still unresolved. Next: capture bounded tool-result traces, avoid treating a venue lookup as a separate hotel property, and carry sourced event/venue evidence into candidate selection and the response. Do not describe the feature as live-verified.


## Completed venue and evidence repair

Latest user: «я запустил запрос, все равно ничего не нашел». Conversation c9a41209-b980-442b-9443-c68fb728496f still failed. Isolated trace revealed three separate failures: ordinary event pages omitted coordinates/timezone; the general free search provider was unavailable and its RSS fallback returned unrelated links; the model returned supported=true for 12 genuine nearby records but constructed noncontiguous JSON quotes, which exact-quote validation correctly rejected.

Changes: direct public Yandex Afisha search-form adapter (Moscow/Saint Petersburg, no private API or key); unrelated fallback results filtered by query text; missing venue geometry resolved against stored named POIs with semantic identity selection; unzoned dates retained only as calendar-day evidence for whole-day intervals; legacy HTML charsets decoded; event source records use readable factual text. Up to5000 candidate hotels are measured from one page, nearest12 records go to evidence verification, empty observations no longer flood the agent. Each hotel's explanation carries only its own verified quotes. Event reference is no longer intentionally split into a separate hotel-property wish. Raw response shapes did not change.

Validation:817unit/contract tests passed; ruff, mypy457files and3import contracts pass. Full format check still flags an unrelated concurrent ostrovok_details.py line; edited files formatted. Early failures: new fixture used positional keyword-only NamedPlaceRecord (fixed), old tests expected unknown timezone to reject even whole-day evidence (updated to assert date-only/no exact time), and a test depended on the old internal requested_start text key (now checks both actual boundaries). No failed checks are hidden by skipping.

Isolated live run f590492b-74ce-48db-b116-03c18fcb361e returned6hotels, all6 accepted by recommendation review. Main deployed as event-venues-20261026 (image manifest a1e809e9), same DeepSeek/free runtime, frontend unchanged and aliased under the same tag for future Compose. Exact user request through :8080 then returned6hotels in53.3s; conversation de5e8f9b-012f-4f0e-9da2-d2f1bc2ac339. Main artifact main-venues-replay.json; isolated-success.json; traces trace-readable-afisha.log and evidence-probe-readable.log. HotelHot,Lefort,Netizen,Ворота,Лефортовский,МКМ. These are two successful executions of one scenario, not a broad event benchmark. No room availability/price guarantee. No source claims all Russian events.

Temporary tracing ran only in separate one-off containers; production code has no debug monkeypatches. Temporary environment snapshots removed after use. The current runtime includes local uncommitted event work plus the source state at build; concurrent Git HEAD moves are not a deployment version by themselves.
