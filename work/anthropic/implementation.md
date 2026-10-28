# Anthropic adapter verification

Date: 2026-10-26, Europe/Moscow.
Branch: `feat/hotel-agent-mvp`, base HEAD `8e229bc`. Changes remain uncommitted.
User request, verbatim: «напиши адаптер под llm антропиков».

## Implementation

- `AnthropicLLM` implements every `LLMPort` method through `StructuredLLM`, shared with
  `OpenAICompatLLM`. `Completion` isolates the provider HTTP protocol inside the adapters layer.
- Native Messages requests use a separate system prompt, x-api-key, API version 2026-10-21,
  and output_config.format. Sampling and OpenAI-specific parameters are omitted.
- Current numeric schema constraints are described to the model and enforced locally with the
  original JSON Schema. jsonschema moved from development to runtime dependencies; lock updated.
- Network failures retry once; a configured backup is used on retry and on primary 5xx.
  Authentication and quota errors fail without retry. Refusal, truncation, malformed HTTP JSON,
  schema violations and empty text become ModelFailure.
- Configuration uses existing LLM_PROVIDER=anthropic, LLM_API_KEY, LLM_MODEL, LLM_BASE_URL,
  LLM_FALLBACK_MODEL and LLM_TIMEOUT_S. Base URL defaults to https://api.anthropic.com/v1.
- `.env.example`, docs/running.md, docs/architecture.md and docs/design-decisions.md updated.
  The real `.env` and running stand were not changed. No commit, push or paid provider call.

## Checks

All executed from backend unless otherwise stated:

- `uv run ruff check .`: passed.
- `uv run ruff format --check .`: 299 files formatted, passed.
- `uv run mypy .`: 293 source files, passed.
- `uv run lint-imports`: 3 contracts kept, 0 broken.
- `uv run pytest tests/unit tests/contract`: 431 passed, 10 existing dependency warnings.
  Tests use deterministic httpx.MockTransport replies and no network/paid requests.
- Root `node skills/docs-writing/check-links.mjs docs/running.md docs/architecture.md docs/design-decisions.md`: passed.
- Root `git diff --check`: passed.
- No storage or stand change; integration suites and live Anthropic were not run.

## Failed checks during implementation and limits

- Initial test fixtures omitted required ParsedQuery.location_hint and attempted extraction from
  noise_level, whose fields are empty. Fixtures corrected to actual contracts and pets_policy.
- Quote fixture `500 ₽` matched a substring of `1500 ₽` in the pre-existing shared grounding
  logic. Test now uses an unambiguous absent quote `700 ₽`. Numeric suffix matching remains a
  limitation of shared extraction, outside this provider adapter change.
- Schema conversion handles constructs in the current schemas; adding unsupported JSON Schema
  constraints requires updating conversion and tests.
- Live Anthropic availability and semantic quality remain unverified. A manually requested
  `make llm-check` after configuration would spend provider quota.

## Existing unrelated work

The view-search goal remains open. Previous session state was moved verbatim to
[previous-state.md](previous-state.md); `work/window-views/` has pre-existing uncommitted
changes and evaluations. Preserve them. This adapter task does not complete that goal.

## Configuration update, 2026-10-26

The user supplied a key and explicitly requested Claude configuration without running it.
Local ignored/untracked `.env` now selects `anthropic`, `claude-sonnet-4-6`,
`https://api.anthropic.com/v1`, with the supplied key and an empty fallback model.
Static file checks passed. No process startup, restart, request or key validation occurred.
Branch `feat/hotel-agent-mvp`, HEAD `8e229bc`; no new commit.
The existing Makefile `llm-check` target hardcodes `LLM_PROVIDER=openai_compat`;
it must be corrected before using it for Anthropic. It was not run.
