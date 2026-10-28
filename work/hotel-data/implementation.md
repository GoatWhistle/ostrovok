# Hotel provider discovery and matching

Date: 2026-10-26, Europe/Moscow. Branch `feat/hotel-agent-mvp`, HEAD `8e229bc`; changes uncommitted.

## Scope and result

- Primary-source investigation saved in `work/research/hotel-providers-russia-2026-10-26.md`.
  Research worker used its own detached worktree at `/tmp/o-hack-hotel-provider-research-20261026`;
  parent copied its one owned report into the main tree. No account actions, applications,
  provider-key requests, messages to third parties or paid calls.
- Added `NuiteeDiscovery`, `HotelIdentity` assessments and `MatchHotelCatalog`.
  On-demand matching uses existing local name/address/coordinates and native catalog pagination.
  Provider IDs are no longer required manually for each new local hotel.
- Offers with dates invoke matching for unmapped Nuitee hotels. Complete unique identity must
  pass again against detail data before save. CLI `match-nuitee --hotel-id ...` only reports;
  `--apply` imports a unique verified match. Existing mappings avoid catalog calls.
- Catalog store locks the local hotel and refuses replacing an existing supplier ID. Unique
  provider/local constraints are translated into an explicit mapping conflict.
- No new migration or HTTP shape. Source details, facilities and rooms use existing tables.
  No frontend changes. No new provider beyond Nuitee connected; Yandex, Bronevik and Ostrovok
  require partner access. OSM national coverage is separate from supplier inventory.
- Product instructions and limits: `docs/hotel-data.md`, linked from documentation and running guide.

## Validation

- `uv run ruff check .`: passed.
- `uv run ruff format --check .`: 308 files formatted, passed.
- `uv run mypy .`: 302 source files, passed.
- `uv run lint-imports`: 3 contracts kept, 0 broken.
- `DBMATE_BIN=/tmp/o-hack-provider-tools/dbmate LLM_PROVIDER=fake NUITEE_API_KEY= ETG_KEY_ID= ETG_API_KEY= uv run pytest tests/unit tests/contract tests/integration`: 500 passed, 11 dependency warnings. This includes 9 integration tests. Catalog tests create isolated PostgreSQL databases, apply real migrations with dbmate and drop them. Existing view/seed E2E tests use the running local database with fake LLM and provider keys disabled.
- Unit/contract count is 491; provider tests use MockTransport, no external endpoints.
- `python -m hotel_agent.cli match-nuitee --help`: passed without connecting to DB/providers.
- Documentation links and `git diff --check`: passed.
- `dbmate` was absent from PATH; official macOS arm64 v2.36.0 binary downloaded to
  `/tmp/o-hack-provider-tools/dbmate` for these tests. No application/Compose restart.

## Failed checks and limitations

- Initial new fixtures omitted a ParsedQuery field and selected an undeclared catalog field
  during the earlier adapter task; see `work/anthropic/implementation.md`.
- New matcher test used `dataclasses.replace` with overly broad kwargs; corrected to TypedDict.
- Initial storage assertion counted 2 search documents; actual view includes OSM, facilities and
  room records. Test now checks the real room document capacity. All integration tests pass.
- Matching thresholds are heuristics, with no live labelled accuracy or national coverage run.
  No direct-address API parameter exists in Nuitee; coordinates select candidates, address
  verifies locally. Address parser is conservative and does not replace FIAS.
- Missing/misplaced coordinates, rebrands, spelling and separate buildings can remain unmapped.
  Partial, duplicate, invalid and ambiguous provider responses never auto-import.
- No negative cache or single-flight yet. A miss can repeat provider calls, and first lookup adds
  latency. Search is bounded to five 200-result pages in 1 km. No bulk national sync was run.
- Room floors, window orientation and dates availability are not inferred from catalog absence.
- All live provider coverage remains unverified. Claude is configured locally but unstarted;
  user prohibition on startup/provider calls remains active. Real `.env` untouched this turn.
- Preserve other pending `work/window-views/` artifacts and the earlier Anthropic changes.
