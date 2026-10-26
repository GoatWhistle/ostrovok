# Per-wish agent search

User request, verbatim: «Твоя задача сейчас сделать агентский цикл, на каждую хотелку пользователь агент должен ходить и вызывать инструменты до тех пор, пока либо не поймет, что ничего найти не может, либо не найдет. Он должен по смыслу сопоставить описание человеком его желание с данными из бд, эмбедингов, данных отеля из провайдера».

Worktree: /Users/savelij/projects/o-hack-window-views, branch feat/per-wish-agent-loop.
Original root contains separate Anthropic adapter work. Keep it intact. Claude is configured for
next startup, with explicit user instruction not to start/restart or call it. No paid calls or
stand restart for this task without a later explicit instruction.

Acceptance:
- Every wish enters the loop, including parsed/basic/geographic/provider wishes and free text.
- Each wish has its own observations and terminal state. No shared five-call stop. Positive
  evidence resolves only its own wish; an empty/negative result triggers another useful source.
- DB facts and requested geographic checks are tools, executed on demand. Semantic retrieval
  selects candidates; source quotes and semantic verification establish a match.
- Agent can inspect DB records without guessed text filters, page through semantic checks,
  retrieve provider hotel/room content, query dated availability and inspect its actual records.
- Finish without a match requires a reason and checked sources. Repeat/cost/transport guards
  report incomplete/unavailable, never a fabricated not-found conclusion. Missing stay input
  asks a relevant question and does not hide other matched wishes.
- Evidence and unknown wishes survive in real results and fact cards. Existing map references
  and source provenance remain usable. Both LLM adapters use the existing planning port.
- Offline tests cover separate wishes, >5 calls, empty-source fallback, semantic paraphrase,
  provider room data, quoted-source grounding, premature finish, repetition, unavailable tools
  and partial results with clarification. Run backend static/unit/contract/storage checks.

Implementation: requested-evidence tool, per-wish state machine, semantic record reader and
provider-content/offer datasets; wire SearchHotels to the loop, keep LLMPort transport unchanged.

Additional user request, verbatim: «еще если по апишке нет данных по отелю, то попытайся найти в интернете информацию по номерам этого отеля».

Implemented: all wishes enter separate loops; requested DB keys/IDs only; semantic batch
verification across stored/retrieved/provider/offer/web records; explicit exhaustion guards,
independent unknown/clarification states and positive partial results. Missing provider rooms
automatically trigger a hotel-specific web search; a page must be read and verified. Limits
32 steps/180 seconds per wish, 600 seconds total. nginx response timeout raised to 900 seconds.

Validation: 448 backend unit/contract/integration tests, including seven PostgreSQL integrations;
20 scripted wish paraphrases and source transitions, not live model evaluations. Ruff, format,
mypy/import checks pass. Frontend verify: 324 tests, 36 rules, build. Prior integration expected
legacy keys; updated it to check the requested label, actual persisted fact and map references.
No paid/live external calls or stand restart. Own code is on feat/per-wish-agent-loop.

Merge caution: original root has independent uncommitted Anthropic and free hotel-data work.
Do not overwrite it. Shared files need a three-way merge, particularly catalog exception types,
GetHotelOffers.configured and main.py. In root, CatalogProviderFailure lives in hotel_discovery;
this branch adds it to hotel_catalog. Unify the exception import when integrating both changes.
Provider content must follow the existing free-mode guard. Live-model validation remains pending
until the user explicitly authorizes a launch. Earlier window-view goal remains incomplete.

Code commit: fa4fd16, feat/per-wish-agent-loop. Full checks repeated after the final code change: 448 passed; pre-commit unit-only gate: 436 passed.
