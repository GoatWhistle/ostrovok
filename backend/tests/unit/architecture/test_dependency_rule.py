import ast
import sys
from dataclasses import dataclass
from graphlib import CycleError, TopologicalSorter
from pathlib import Path

import pytest

PACKAGE = "hotel_agent"
SOURCE_ROOT = Path(__file__).resolve().parents[3] / "src"
ALLOWED_LAYERS = {
    "domain": {"domain"},
    "application": {"application", "domain"},
    "adapters": {"adapters", "application", "domain"},
    "interfaces": {"interfaces", "application", "domain"},
}
INNER_LAYERS = {"domain", "application"}
PURE_LIBRARIES: frozenset[str] = frozenset()
OWNED_LIBRARIES = {"logging": "adapters.log"}


@dataclass(frozen=True)
class Import:
    source: str
    target: str
    line: int


def discover_modules(root: Path, package: str) -> dict[str, Path]:
    modules = {}
    for path in sorted((root / package).rglob("*.py")):
        parts = path.relative_to(root).with_suffix("").parts
        if parts[-1] == "__init__":
            parts = parts[:-1]
        modules[".".join(parts)] = path
    return modules


def resolve_base(node: ast.ImportFrom, module: str, is_package: bool) -> str:
    if node.level == 0:
        return node.module or ""
    parts = module.split(".") if is_package else module.split(".")[:-1]
    parts = parts[: len(parts) - node.level + 1]
    return ".".join([*parts, node.module] if node.module else parts)


def collect_imports(modules: dict[str, Path]) -> list[Import]:
    imports: list[Import] = []
    for module, path in modules.items():
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imports.extend(Import(module, alias.name, node.lineno) for alias in node.names)
            elif isinstance(node, ast.ImportFrom):
                base = resolve_base(node, module, path.name == "__init__.py")
                for alias in node.names:
                    submodule = f"{base}.{alias.name}"
                    target = submodule if submodule in modules else base
                    imports.append(Import(module, target, node.lineno))
    return imports


def layer_of(module: str) -> str:
    parts = module.split(".")
    return parts[1] if len(parts) > 1 else "<package root>"


def owner_violation(item: Import, package: str) -> str | None:
    library = item.target.split(".")[0]
    owner = OWNED_LIBRARIES.get(library)
    if owner is None:
        return None
    prefix = f"{package}.{owner}"
    if item.source == prefix or item.source.startswith(f"{prefix}."):
        return None
    return f"{item.source}:{item.line} imports {item.target}: only {prefix} may use {library}"


def layer_violations(root: Path, package: str) -> list[str]:
    violations = []
    for item in collect_imports(discover_modules(root, package)):
        owned = owner_violation(item, package)
        if owned is not None:
            violations.append(owned)
            continue
        source_layer = layer_of(item.source)
        allowed = ALLOWED_LAYERS.get(source_layer)
        if allowed is None:
            continue
        top = item.target.split(".")[0]
        if top == package:
            if layer_of(item.target) in allowed:
                continue
            reason = f"{source_layer} may import only {sorted(allowed)}"
        elif (
            source_layer not in INNER_LAYERS
            or top in sys.stdlib_module_names
            or top in PURE_LIBRARIES
        ):
            continue
        else:
            reason = f"{source_layer} may use only the standard library and pure libraries"
        violations.append(f"{item.source}:{item.line} imports {item.target}: {reason}")
    return violations


def import_cycles(root: Path, package: str) -> list[str]:
    modules = discover_modules(root, package)
    graph: dict[str, set[str]] = {module: set() for module in modules}
    for item in collect_imports(modules):
        if item.target in modules:
            graph[item.source].add(item.target)
    try:
        tuple(TopologicalSorter(graph).static_order())
    except CycleError as error:
        return [" -> ".join(error.args[1])]
    return []


def write_package(root: Path, files: dict[str, str]) -> None:
    for name, source in files.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(source, encoding="utf-8")
    for directory in [root / "pkg", *(root / "pkg").rglob("*")]:
        if directory.is_dir() and not (directory / "__init__.py").exists():
            (directory / "__init__.py").write_text("", encoding="utf-8")


def test_scanner_sees_runtime_package() -> None:
    modules = discover_modules(SOURCE_ROOT, PACKAGE)

    assert {layer_of(module) for module in modules} >= INNER_LAYERS
    assert collect_imports(modules)


def test_layers_follow_dependency_rule() -> None:
    assert layer_violations(SOURCE_ROOT, PACKAGE) == []


def test_package_imports_are_acyclic() -> None:
    assert import_cycles(SOURCE_ROOT, PACKAGE) == []


CLEAN_PACKAGE = {
    "pkg/domain/entity.py": "from dataclasses import dataclass\n",
    "pkg/application/ports/llm.py": "from pkg.domain.entity import dataclass\n",
    "pkg/adapters/client.py": "import httpx\nfrom ..application.ports import llm\n",
    "pkg/main.py": "from pkg.adapters import client\nfrom pkg.interfaces.http import routes\n",
    "pkg/interfaces/http/routes.py": "import fastapi\nfrom pkg.domain.entity import dataclass\n",
    "pkg/adapters/log/stdlib.py": "import logging\n",
}


def test_clean_package_passes(tmp_path: Path) -> None:
    write_package(tmp_path, CLEAN_PACKAGE)

    assert layer_violations(tmp_path, "pkg") == []
    assert import_cycles(tmp_path, "pkg") == []


@pytest.mark.parametrize(
    ("files", "expected"),
    [
        (
            {"pkg/domain/entity.py": "def load() -> None:\n    from pkg.adapters import client\n"},
            "pkg.domain.entity:2 imports pkg.adapters",
        ),
        (
            {
                "pkg/domain/entity.py": "def load() -> None:\n    from pkg.application import ports\n"
            },
            "pkg.domain.entity:2 imports pkg.application",
        ),
        (
            {
                "pkg/application/ports/llm.py": (
                    "from typing import TYPE_CHECKING\n"
                    "if TYPE_CHECKING:\n"
                    "    from pkg.adapters.db import store\n"
                ),
                "pkg/adapters/db/store.py": "",
            },
            "pkg.application.ports.llm:3 imports pkg.adapters.db.store",
        ),
        (
            {"pkg/application/ports/llm.py": "import httpx\n"},
            "pkg.application.ports.llm:1 imports httpx",
        ),
        (
            {"pkg/domain/__init__.py": "from pydantic import BaseModel\n"},
            "pkg.domain:1 imports pydantic",
        ),
        (
            {"pkg/adapters/client.py": "from ..interfaces.http import routes\n"},
            "pkg.adapters.client:1 imports pkg.interfaces.http.routes",
        ),
        (
            {"pkg/interfaces/http/routes.py": "from pkg.adapters.client import Client\n"},
            "pkg.interfaces.http.routes:1 imports pkg.adapters.client",
        ),
        (
            {"pkg/interfaces/http/routes.py": "from pkg.main import settings\n", "pkg/main.py": ""},
            "pkg.interfaces.http.routes:1 imports pkg.main",
        ),
        (
            {"pkg/application/ports/llm.py": "import pkg\n"},
            "pkg.application.ports.llm:1 imports pkg",
        ),
        (
            {"pkg/interfaces/http/routes.py": "import logging\n"},
            "pkg.interfaces.http.routes:1 imports logging",
        ),
        (
            {"pkg/adapters/client.py": "from logging import getLogger\n"},
            "pkg.adapters.client:1 imports logging",
        ),
        (
            {"pkg/main.py": "import logging.handlers\n"},
            "pkg.main:1 imports logging.handlers",
        ),
        (
            {"pkg/adapters/logbook.py": "import logging\n"},
            "pkg.adapters.logbook:1 imports logging",
        ),
    ],
)
def test_forbidden_import_is_reported(tmp_path: Path, files: dict[str, str], expected: str) -> None:
    write_package(tmp_path, {**CLEAN_PACKAGE, **files})

    violations = layer_violations(tmp_path, "pkg")

    assert any(violation.startswith(expected) for violation in violations), violations


def test_reexport_cycle_is_reported(tmp_path: Path) -> None:
    write_package(
        tmp_path,
        {
            "pkg/domain/__init__.py": "from .entity import Entity\n",
            "pkg/domain/entity.py": "from pkg.domain import rules\n",
            "pkg/domain/rules.py": "from pkg.domain import Entity\n",
        },
    )

    assert import_cycles(tmp_path, "pkg") != []
    assert layer_violations(tmp_path, "pkg") == []
