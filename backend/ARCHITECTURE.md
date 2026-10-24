# Backend architecture

Read before implementing or restructuring backend code. Follow Clean Architecture: business rules
and use cases own their interfaces; outer modules implement transport and external dependencies.

## Layout

Paths below are relative to `backend/`. The package is `hotel_agent`. Create subject modules as the
real scenario requires them.

```text
backend/
  AGENTS.md
  ARCHITECTURE.md
  API.md
  DATABASE.md
  TESTING.md
  src/hotel_agent/
    domain/
    application/
      ports/
      use_cases/
      agent/
    adapters/
      llm/
      db/
      geo/
      tools/
      external/
      registry/
      log/
      clock/
    interfaces/
      http/
        routers/
      cli/
    composition.py
    settings.py
    main.py
  migrations/
    postgres/
  tests/
    unit/
      domain/
      application/
      adapters/
      interfaces/
      architecture/
      composition/
    contract/
    integration/
      repository/
        postgres/
      e2e/
  scripts/
  benchmarks/
```

Each empty leaf folder contains `.gitkeep` so Git can preserve the layout. Remove that file when
adding actual content. `Dockerfile`, `pyproject.toml`, `uv.lock`, the `backend` and `db` Compose
services, the registry adapter, the fake LLM adapter and the HTTP skeleton exist; the dbmate
`migrate` Compose service, migrations and the geo adapters are added by the stage that needs them.

The Markdown instructions are internal and scrubbed before submission. Runtime source, migrations,
tests and project configuration ship. Benchmarks and scripts call the same use cases as the
product. Reference material stays outside the runtime package and is read only by its explicit owner.

## Responsibilities and imports

| Module | Owns | Allowed project dependencies |
| --- | --- | --- |
| `domain` | Entities, value objects, business invariants, state transitions, pure calculations, domain errors | `domain` |
| `application` | Use cases, commands/results, DTOs, ports, the agent loop, Unit of Work port | `application`, `domain` |
| `adapters` | Persistence (`adapters/db/`) and external capabilities: LLM, geo, OSM/DEM import, HTTP APIs, registry, logging | `adapters`, `application`, `domain` |
| `interfaces` | HTTP routes, Pydantic schemas, CLI commands, request/result mapping, HTTP error mapping | `interfaces`, `application`, `domain` |
| `composition.py`, `main.py` | Configuration, concrete dependency construction, lifecycle, router registration | All runtime modules |

`domain` and `application` use ordinary Python types and `dataclasses`. They do not import FastAPI,
Pydantic, database drivers, provider SDKs, `yaml`, `adapters`, `interfaces`, `composition.py`,
`settings.py` or `main.py`. Pure computation libraries require an explicit project decision when
standard Python is insufficient. Dependencies stay acyclic, including imports used only for
annotations or hidden inside functions.

`interfaces` and `adapters` do not import each other; they meet only through `application` ports.
The composition root is the place that knows all of them. Internal calculations stay inside
their owning module; an interface is needed where a use case depends on an external capability.

## Domain

- Express business invariants next to the entity or value they protect, using domain language from
  `docs/glossary.md`. Reuse the same rule for HTTP, seed scripts, workers and command-line entry points.
- Reject invalid transitions before mutating state. Domain errors describe the business failure,
  without HTTP statuses or localized text.
- Use a pure domain function for a rule spanning several entities. Give its file the subject's name.
- Time, randomness and identifiers affecting business behavior arrive as values or supplied
  dependencies; pure rules do not reach for environment variables, global clocks or network clients.

## Use cases

- A use case represents a user or system action with a small typed input and result. It loads the
  required state, checks the actor's access, invokes domain rules and coordinates persistence.
- Declare ports as typed protocols in `application/ports/<subject>.py`. Name methods after required
  operations; expose domain values or use case results.
- Keep connections, driver rows, HTTP requests/responses and provider objects outside port
  signatures. Commands, results and DTOs are dataclasses without framework validation behavior.
  Repository DTOs live in `application/dto.py` (see [DATABASE.md](DATABASE.md)).
- Supply repositories, transaction scopes, providers and clocks through constructors. Construction
  does not select implementations or perform I/O.
- The use case owns the consistency boundary. It opens a Unit of Work per operation and commits
  through it; controllers, repositories and domain entities do not commit.

## Repositories, adapters and controllers

- Map SQL rows to DTOs inside the repository; no ORM is used. Map external provider responses inside
  that provider's adapter. Translate storage- and provider-specific failures into failures defined
  by the port.
- Repositories implement persistence/query operations in `adapters/db/`, one module per aggregate
  or read model. Other adapters implement non-storage external capabilities. Repositories and other
  adapters do not call each other; a use case coordinates both.
- Decisions about allowed business actions remain in the domain and use cases; database
  constraints support those rules under concurrency.
- HTTP schemas live in `interfaces/http/schemas.py` and follow `docs/api/openapi.yaml` exactly.
  Validate request shape there, invoke the use case and map its result to an explicit response
  schema. HTTP mapping is specified in [API.md](API.md).
- Keep parsing and persistence models separate even when they initially share fields. Public input
  must not become a stored row or select arbitrary stored columns.

## Composition and lifecycle

- `composition.py` builds providers from `Settings`; `main.py` reads configuration, builds use
  cases from those providers and registers their routers. Use ordinary factories and constructors.
- Database pools and provider clients are started and closed through the application lifecycle.
  Transaction/session resources have request or operation scope, not shared mutable global state.
- A worker or script may have its own entry point and reuse common composition functions. It calls
  the same use case interfaces; it does not depend on HTTP controllers.
- Domain and application modules never import `main.py`, `composition.py` or `settings.py`,
  including through re-exports in `__init__.py`. An import-linter contract enforces it.

## Where new code belongs

| Change | Location |
| --- | --- |
| New invariant or state transition | `domain/<subject>.py` |
| New action | `application/use_cases/<action>.py` |
| Port required by an action | `application/ports/<subject>.py` |
| SQL query, row mapping or Unit of Work | `adapters/db/` |
| Repository DTO | `application/dto.py` |
| New characteristic | `characteristics/<key>.yaml`, no code change |
| Characteristic tool implementation | `adapters/tools/<key>.py`, registered in `ToolRegistry` |
| Geo computation against OSM, DEM or a graph | `adapters/geo/` |
| External provider implementation | `adapters/<area>/<provider>.py` |
| HTTP endpoint or schema | `interfaces/http/routers/`, `interfaces/http/schemas.py` |
| CLI command | `interfaces/cli/main.py` |
| Schema change | `migrations/postgres/`, created by `dbmate new` |
| Concrete dependency selection | `composition.py`, wiring in `main.py` |

Use subject names within each layer. A new generic `models/` or `service/` bucket obscures whether
code owns domain rules, transport, persistence or orchestration; place it by that responsibility.
Enforce the import contract as described in [TESTING.md](TESTING.md).
