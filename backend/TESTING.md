# Backend validation

Read before changing tests or reporting a backend change as validated. The architecture contract is
in [ARCHITECTURE.md](ARCHITECTURE.md); test doubles and fixtures live only in `backend/tests/`.

Tests are split by what they need to run:

- `tests/unit/` runs in-process with no database server, container, network or running stand. It
  holds `domain/`, `application/`, `adapters/`, `interfaces/`, `composition/` and the
  import-contract checks in `architecture/`. Adapter tests here replace the provider client or SDK
  call.
- `tests/contract/` also needs nothing started. It validates HTTP responses against
  `docs/api/openapi.yaml`, which is the source of truth for the frontend. Add a case there for
  every endpoint as it lands, and change the contract file before changing a response shape.
- `tests/integration/` needs real local infrastructure and the `dbmate` binary:
  `repository/postgres/` uses disposable PostgreSQL with PostGIS, `e2e/` uses the seeded running
  stand. An adapter test against a local container or server goes to
  `integration/adapters/<provider>/`.

Inside each group, folders mirror layer responsibilities. Put a test in `unit/` only if it passes
on a clean checkout after `uv sync`, with nothing else started. The pre-commit hook runs
`tests/unit` whenever `backend/` is staged, so unit tests stay fast and deterministic.

## Test by responsibility

| Scope | Exercise | Evidence |
| --- | --- | --- |
| Domain | Pure rules and state transitions on ordinary Python values | Valid cases, boundary values and rejection without mutation |
| Use case | Use cases through their public interface, supplying test implementations of ports | Access decisions, orchestration, expected failures and transaction behavior |
| PostgreSQL repository | Real disposable PostgreSQL with PostGIS and the actual migrations | Queries, geometry round-trip, constraints, rollback and concurrent operations |
| Contract | Every implemented endpoint against `docs/api/openapi.yaml` | Response bodies validate, and no served route is missing from the contract |
| Provider adapter | Local deterministic responses or a local test server | Mapping, timeout/error handling and malformed provider responses |
| HTTP | Requests through the configured app and real use cases | Schemas, statuses, error envelope and visibility |
| End to end | The seeded running stand on the jury route | The actual user scenario across HTTP and storage |

An HTTP test with test doubles proves the HTTP mapping; it is not evidence of working persistence
or a completed end-to-end scenario. Database-dependent acceptance paths use real PostgreSQL.

## Environment and repeatability

- Automated checks never call external internet services or paid providers. Local disposable
  PostgreSQL and local test servers are permitted; they require no paid key.
- Keep unit tests runnable without databases. Integration tests run with
  `uv run pytest tests/integration`, use isolated database configuration and fail clearly when the
  required database is unavailable.
- `addopts` passes `-n auto`; `tests/conftest.py` turns it into one xdist worker per 16 test files
  and runs serially below 32 files. Tests sharing a database isolate per worker through
  `worker_id`. Override with `-n <count>` or `-n 0` for debugging.
- Keep slow benchmarks, quality experiments and paid runs behind separate manual commands. Default
  test collection does not spend credits, download models or silently skip a required integration
  suite while reporting the full scenario as verified.
- Supply fixed clocks, seeds and identifiers where behavior depends on them. Tests own their data
  and cleanup; order and parallel execution do not change the result.
- Use fakes for a use case's ports, while testing each production repository and adapter against
  its real or local protocol. Assert business outcomes instead of reproducing the implementation.

## Architecture checks

When the runtime package is introduced, add an automated check for its allowed imports:

- `domain` depends on domain code and permitted pure libraries.
- `application` depends on application/domain code, never on frameworks, drivers or adapters.
- `interfaces` and `adapters` do not import each other.
- Inner modules do not import `main.py`, `composition.py` or `settings.py`.
- Imports and re-exports remain acyclic. Cover annotation imports and package `__init__.py` files.
- A library listed in `OWNED_LIBRARIES` is imported only by its owner module (`logging` by
  `adapter.log`).

Two checks cover this: `uv run lint-imports` reads the contracts in `pyproject.toml`, and
`tests/unit/architecture/test_dependency_rule.py` parses every module with `ast` so that imports in
annotations, inside functions and in `__init__.py` are caught too. Both must inspect the package
rather than a hand-maintained list of files. Confirm that a forbidden dependency is detected before
treating either guard as evidence.

## Checks before reporting completion

Once `pyproject.toml` declares the tools and the runtime exists, run from `backend/`:

```bash
uv run ruff check .
uv run ruff format --check .
uv run mypy .
uv run lint-imports
uv run pytest tests/unit
uv run pytest tests/contract
uv run pytest tests/integration
```

From the repository root, `make lint` and `make test` run the same commands.

`uv run pytest` runs every group. An empty integration group exits with code 5 ("no tests ran");
that is not evidence of integration coverage.

The commands cover `src/hotel_agent/`, the applicable scripts and tests. Declare the architecture
check and integration command alongside them in product `docs/running.md`. Report which suites ran
and what each demonstrates.

For behavior changes, validate the affected use case and applicable HTTP/database behavior. For
concurrency rules, exercise overlapping operations. For documentation-only changes, check affected
links and cleanup paths; a runtime suite does not demonstrate that the instructions are coherent.

Composition tests live in `tests/unit/composition/`, HTTP mapping tests in
`tests/unit/interfaces/`. The architecture check parses every module under `src/hotel_agent` with
`ast`; allowed layers live in `ALLOWED_LAYERS`, extra pure libraries for `domain`/`application` in
`PURE_LIBRARIES`. The fake LLM adapter is deterministic and makes no network calls; passing its
tests says nothing about a real provider call.
