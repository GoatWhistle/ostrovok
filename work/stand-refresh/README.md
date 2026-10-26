# Stand source reconciliation

2026-10-26. Original root stayed on8e229bc with concurrent uncommitted features. A root
build replaced the window-loop image during round3. Restoring a tag alone would repeat this.

Reconstructed prior root snapshot from8e229bc and stand-restart/root-runtime.patch,
plus its untracked-files manifest. Compared current root snapshot and applied delta via
three-way merge into verified stand branch.77 changed paths; resolved3 conflicts preserving
chat consultation routing, semantic search-answer review and native offline review.
New root height/geography/provider/frontend changes retained; no root reset/staging/commit.

Merged validation:737 backend unit/contract/integration tests, Ruff/format/mypy/import-linter;
frontend328 tests,36 rules, typecheck/lint/build. All pass after fixing merge-related fixtures
and retaining the chat answer-review seam.

Synced76 verified agent delta files back into original root with a preflight byte comparison
and git apply --check. Existing root edits are part of the merged result; no newer source
conflicts were detected. All76 files match after sync. Future root builds include agent fixes.
Scripts/patches/manifests preserve the exact operation; no credentials captured.

Deployment/full50 remains next. Use immutable-image guard to detect runtime replacement.
