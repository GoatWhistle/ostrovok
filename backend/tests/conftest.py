import os
from pathlib import Path

import pytest

from hotel_agent.settings import Settings

FILES_PER_WORKER = 16
CHARACTERISTICS_DIR = Path(__file__).resolve().parents[2] / "characteristics"


@pytest.fixture
def characteristics_dir() -> Path:
    return CHARACTERISTICS_DIR


@pytest.fixture
def settings() -> Settings:
    return Settings(characteristics_dir=CHARACTERISTICS_DIR)


def count_test_files(config: pytest.Config) -> int:
    total = 0
    for arg in config.args:
        path = Path(config.invocation_params.dir, arg.split("::")[0])
        if path.is_file():
            total += 1
        elif path.is_dir():
            total += sum(1 for _ in path.rglob("test_*.py"))
    return total


@pytest.hookimpl(tryfirst=True)
def pytest_xdist_auto_num_workers(config: pytest.Config) -> int | None:
    if os.environ.get("PYTEST_XDIST_AUTO_NUM_WORKERS"):
        return None
    workers = min(os.cpu_count() or 1, count_test_files(config) // FILES_PER_WORKER)
    return workers if workers > 1 else 0
