# Session before hotel-provider work

## Current state

- Anthropic adapter implemented, uncommitted on `feat/hotel-agent-mvp` / HEAD `8e229bc`. All LLMPort methods share parsing with OpenAI; native Messages, schema validation, retries and backup model are covered. [Details and checks](../work/anthropic/implementation.md).
- 431 backend unit/contract tests, Ruff, formatting, mypy and import checks passed. No paid calls or stand restart. Local `.env` now selects `anthropic` / `claude-sonnet-4-6` with the supplied key and default Messages endpoint; backup cleared.
- Window-view goal remains active and incomplete. Previous state and all pending pitfalls moved verbatim to [work/anthropic/previous-state.md](../work/anthropic/previous-state.md); continue from `work/window-views/plan.md`.

## Next actions and pitfalls

- Claude is configured for the next startup only. Do not start/restart or call the provider until requested. Live endpoint/key remain unverified.
- Preserve unrelated pending window-view changes. Existing quote-grounding substring limitation is recorded in the adapter notes.
- Protected instructions exceed SESSION target; preserve them verbatim.
