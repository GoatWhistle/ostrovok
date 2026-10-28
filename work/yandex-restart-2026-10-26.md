# Yandex DeepSeek restart — 2026-10-26

User instruction: «запусти опять на дипсике из яндекса».
Branch: `feat/hotel-agent-mvp`, HEAD `8e229bc`; existing work remains uncommitted.
This request supersedes the earlier instruction to configure Claude without restarting.

## Runtime and verification

- Recovered the existing Yandex credentials from the running backend container without printing them.
  Updated ignored `.env` to `LLM_PROVIDER=openai_compat`,
  `LLM_BASE_URL=https://llm.api.cloud.yandex.net/v1`,
  `LLM_MODEL=gpt://b1g8s6hsnfapn48225d1/deepseek-v4.1-flash/latest`.
  Existing Qwen fallback and 30-second timeout restored; Anthropic key retained only in `.env`.
- Kept `HOTEL_DATA_MODE=free`; rebuilt backend with current code using `docker buildx bake backend`
  and recreated only backend with `docker compose up -d --no-deps --force-recreate --wait backend`.
  The old image lacked free-data mode; new container confirms it is active.
- `GET http://localhost:8000/api/v1/health`: HTTP200, `status=ok`, `llm_provider=openai_compat`.
  Frontend `http://localhost:8080/`: HTTP200. Existing frontend image retained.
- One manual live search through frontend proxy: `POST /api/v1/search`, query
  «Нужен отель в Сочи», `region_id=russia`, `limit=3`, `compute_missing=false`.
  HTTP200 in 4.40 seconds, three hotel results, `location_hint=Сочи`,
  `query_id=9c3c1ca4e69a19cf`. No model-retry warning in startup/request logs.
  This smoke check does not assess arbitrary wishes, room availability or view accuracy.
- `uv run ruff check .` and `uv run mypy .`: passed (305 source files checked by mypy).
- `uv run pytest tests/unit tests/contract`: 502 passed, 11 dependency warnings.
- First integration attempt: six passed, three setup errors because dbmate absent from PATH.
  Reused existing `/tmp/o-hack-provider-tools/dbmate` via `DBMATE_BIN`; rerun with fake LLM,
  free hotel-data mode and partner keys empty: all nine integration tests passed, one warning.
- No source implementation changes, migration changes, model indexing, seed import or commits.

## Previous current state and next actions (verbatim)

## Current state

- `feat/hotel-agent-mvp`, HEAD `8e229bc`; earlier code changes uncommitted. Event/afisha research completed, no new runtime/config changes. [Source shortlist + venue/date matching plan](../work/research/hotel-events-sources-2026-10-26.md) links regional and community reports.
- KudaGo documents free API with source-link conditions; anonymous locations request returned403 in this environment. Timepad public query403 requires token; PRO event query403 too. Their ready free access/coverage not proven. SPbcult public XLSX fetched and headers parsed; public calendar and SPbU conference pages documented. No paid/key/account calls or stand/model startup.
- Report links and whitespace checks passed; product tests not rerun for research-only edits. Previous free-mode/511-test/source state preserved [here](../work/hotel-data/session-before-events.md).

## Next actions and pitfalls

- Event search is not implemented. Confirm permitted access/free conditions before adapters; do not bypass403 or send partner applications. KHL forbids automatic extraction without permission.
- Join specific occurrence/date/timezone → actual venue → route from hotel. Avoid publication dates, organizer addresses, cancelled/online events. Free source != free ticket/availability; partial afisha cannot prove quietness.
- Preserve free-source and no-start instructions. Window goal remains incomplete; retain prior artifacts. Protected SESSION instructions exceed target; preserve verbatim.
