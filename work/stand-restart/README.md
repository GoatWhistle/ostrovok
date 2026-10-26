# Agent stand restart, 26 October 2026

User request, verbatim: «перезапусти стенд».

Deployment source: `/Users/savelij/projects/o-hack-stand`, branch
`fix/stand-agent-integration`, code commits `0bb2ea1` and `3abcbf7`.
Merged the existing root's runtime snapshot (base `8e229bc`) into the per-wish agent branch
`a422515` in this isolated worktree. The original root's uncommitted source is preserved.
Snapshot manifest and three-way patch: `snapshot.json`, `root-runtime.patch`.

## Running version

Root Compose project remains `/Users/savelij/projects/o-hack`. Only backend/frontend containers
were recreated; DB and terrain volumes were retained. The additive geography coverage migration
was applied. Root ignored `.env` now pins `TAG=agent-loop-stand-20261026b`. Model credentials were
not changed: Yandex DeepSeek V4.1 Flash, `HOTEL_DATA_MODE=free`. Claude was not selected.

```bash
cd /Users/savelij/projects/o-hack-stand
TAG=agent-loop-stand-20261026b docker buildx bake backend frontend
cd /Users/savelij/projects/o-hack
docker compose up -d --no-deps --force-recreate --wait backend frontend
```

The first shared `latest` image was superseded by a concurrent build. It did not contain the new
agent modules. Unique image tags now prevent that ambiguity. All six deployed module hashes
match this checkout: `runtime-source-hashes.json`. Both final containers are healthy; nginx -t
passes. Frontend serves `/assets/index-BhRqcKIn.js`.

## Actual failure and correction

Initial new-version query «Нужен тихий отель в Сочи» returned zero hotels in122.73 seconds.
The per-wish loop found evidence, but the final reviewer rejected all60 candidates.
`smoke-with-overstrict-review.json` preserves the response. A minimal live candidate review
rejected a native partial noise estimate. The validator was missing the displayed explanation
and explicit limits of the partial claim; strict source verification and final claim verification
also shared conflicting instructions.

Added the actual explanation and guarantee scope to the reviewed claim, native unit/operator/
threshold to the evidence, and distinct instructions for source, recommendation and chat review.
Removed unnecessary building polygons from the validation context. Corrected a facade tie where
both restricted measurements were partial and a near miss could precede an actually satisfied
bound. Source evidence remains required; a pool still cannot establish underwater accommodation.

Both regressions first failed in deterministic unit tests. A live before/after minimal review is
saved in `review-diagnostic.json` and `review-diagnostic-fixed.json`: the same estimated noise
claim changed from rejected to accepted with a grounded source quote. This is one scenario,
not a general accuracy benchmark. All read/model work ran outside DB transactions.

## Verification

- Backend: Ruff, formatting, mypy and three import contracts passed. Full suite649 passed:
  633 unit,5 contract,11 PostgreSQL integration. Automated checks used fake LLM, empty paid keys,
  disabled Ostrovok site requests and localhost-only geography fallback.
- Frontend:324 tests,36 rule checks, typecheck/lint/build passed. Types regenerated from the
  canonical OpenAPI. Existing dependency/chunk-size warnings remain.
- One final live production chat «Нужен тихий отель в Сочи»: HTTP200,20 hotels,52.15 seconds.
  Its traces show per-wish evaluation and accepted recommendation/answer reviews. Partial
  confirmations are explicitly labelled; no availability promise is made. `live-smoke.json`.
- Reloaded chat retains exactly the answer and hotel list. Hotel card, selected fact and scene
  all return200. Card0.06s, cached conversation0.05s, fact0.00s; cold scene18.29s.
  `route-checks.json`. Scene timing remains a limitation, not a performance success claim.
- The three diagnostic chats were removed after verification. Other conversations were retained.
- First Docker image rebuild hit transient registry authorization transport failure; retry passed.
  Initial Compose wait was interrupted by a parallel restart; final tagged deployment is healthy.

Original window-view objective is still incomplete. Russia bulk geography import and online
hydration remain incomplete/unverified. This restart does not establish room availability,
all-window visibility or semantic accuracy over50 queries. Do not mark that goal complete.
