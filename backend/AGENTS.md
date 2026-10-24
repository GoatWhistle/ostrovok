# Backend rules

Read this file before backend work. The [root instructions](../AGENTS.md) also apply, including
code style, language, file limits and the requirement to use real logic and storage.

## Read by task

| Before | Read |
| --- | --- |
| Any backend implementation or refactor | [ARCHITECTURE.md](ARCHITECTURE.md): layers, imports, ports and composition |
| Changing routes, schemas, errors or authentication | [API.md](API.md): HTTP contracts and permission handling |
| Changing persistence, repositories, migrations, transactions or seed data | [DATABASE.md](DATABASE.md): storage choice, SQL repositories, Unit of Work |
| Adding or changing tests, or reporting validation | [TESTING.md](TESTING.md): test scope and checks |

Read every matching document when a task spans several areas. These four files are internal working
instructions removed at submission. Product documentation lives in `docs/` and describes the
implemented system; product files must not link to these internal instructions.

## Architecture contract

- Use `src/hotel_agent/{domain,application,adapters,interfaces}` with `main.py` as the entry point
  and `composition.py` as the composition root. See [ADR 0002](../docs/adr/0002-layers-inside-backend.md).
- `domain` owns business rules; `application` owns use cases (`application/use_cases/`), ports
  (`application/ports/`) and the agent loop (`application/agent/`). Neither imports framework,
  persistence or provider code. `adapters` implements storage (`adapters/db/`) and external
  providers; `interfaces` owns HTTP (`interfaces/http/`) and the CLI (`interfaces/cli/`). These two
  never import each other.
- Supply dependencies through use case constructors. Concrete implementations are selected at
  startup in `main.py`; controllers call use cases rather than storage or provider SDKs.
- Type hints are required. Explain any necessary `Any` in `docs/design-decisions.md`.
- External providers have a deterministic implementation for the main offline scenario. It computes
  from the input and real stored data. Missing implementations produce an honest error.
- Secrets come from environment variables, with safe defaults in `.env.example`. The stand starts
  without `.env` and releases resources at shutdown.

## Default stack

Python 3.12 (pinned by `.python-version`, matching the image), FastAPI, Pydantic only for HTTP
schemas in `interfaces/http/`, standard `dataclasses` everywhere else, uv, Ruff with line length
100, mypy strict, pytest and import-linter. Geo work uses PostGIS, shapely, pyproj, rasterio and
pyosmium; add them with `uv add` when the stage that needs them starts.

Persistence is decided: PostgreSQL 16 with PostGIS 3.4, raw SQL through psycopg 3, dbmate
migrations ([ADR 0001](../docs/adr/0001-postgis-raw-sql.md)). SQLAlchemy and Alembic are not used
even though the task prompt names them. The rest of the rules are in [DATABASE.md](DATABASE.md):
no ORM, dataclass DTOs at repository ports, Unit of Work for transactions.

Ports live in `application/ports/`: `LLMPort` (`llm.py`), `CharacteristicRegistryPort`
(`registry.py`), `LoggerPort` (`log.py`) and `ClockPort` (`clock.py`). `LLMPort` never returns a
characteristic value: a value comes from a tool or the hotelier, and the model only parses the
query, plans tool calls, writes the hotelier question and splits a free answer into fields with a
quote. `adapters/llm/fake.py` is the deterministic implementation used by every test and the demo;
it reads phrases from the YAML registry, so a new characteristic needs no code change.
`adapters/registry/yaml_loader.py` loads `characteristics/*.yaml` from `CHARACTERISTICS_DIR`.
`adapters/log/stdlib.py` implements `LoggerPort` over `logging`; modules outside `adapters/log/`,
`main.py` included, do not import `logging`, and the import check enforces it.
Empty layer folders keep `.gitkeep`.

`main.py` exposes `create_app()` (run as `uvicorn hotel_agent.main:create_app --factory`). It reads
`Settings` from `settings.py` (`LLM_PROVIDER`, `LLM_*`, `CHARACTERISTICS_DIR`, `SEED_DIR`,
`DATABASE_URL`), builds a `StdlibLogger`, calls `build_providers` from `composition.py`, keeps the
result on `app.state.providers` and closes it at shutdown. Wire a new use case in `main.py` from
`Providers` and pass it to its router; extend `build_providers` when adding a port implementation.
`interfaces/http/errors.py` owns the error envelope and `STATUS_BY_ERROR`; `interfaces/http/app.py`
holds `api_router_v1` with the `/api/v1` prefix; feature routers in `interfaces/http/routers/` are
built by a `build_router(...)` factory, carry no prefix and are included there.
`docs/api/openapi.yaml` is the source of truth for response shapes; change it before changing a
response, and `tests/contract/` checks the two against each other.
`docker-bake.hcl` builds `backend/Dockerfile`; the `backend` Compose service only runs the built
image and bind-mounts `characteristics/` and `data/` read-only. Add new dependencies with `uv add`;
the Dockerfile installs strictly from `uv.lock`. Remove a folder's `.gitkeep` when it gains source
files.
