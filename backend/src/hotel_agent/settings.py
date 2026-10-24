from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path

DEFAULT_DATABASE_URL = "postgresql://hotel:hotel@localhost:5432/hotel"


class LLMProvider(StrEnum):
    FAKE = "fake"
    ANTHROPIC = "anthropic"
    OPENAI_COMPAT = "openai_compat"


class ConfigError(Exception):
    pass


@dataclass(frozen=True, slots=True)
class Settings:
    llm_provider: LLMProvider = LLMProvider.FAKE
    llm_api_key: str | None = None
    llm_base_url: str | None = None
    llm_model: str | None = None
    llm_timeout_s: float = 30.0
    characteristics_dir: Path = Path("characteristics")
    seed_dir: Path = Path("data/seed")
    database_url: str = DEFAULT_DATABASE_URL


def load_settings(env: Mapping[str, str]) -> Settings:
    return Settings(
        llm_provider=_choice(env, "LLM_PROVIDER", LLMProvider, LLMProvider.FAKE),
        llm_api_key=env.get("LLM_API_KEY") or None,
        llm_base_url=env.get("LLM_BASE_URL") or None,
        llm_model=env.get("LLM_MODEL") or None,
        llm_timeout_s=_positive(env, "LLM_TIMEOUT_S", 30.0),
        characteristics_dir=Path(env.get("CHARACTERISTICS_DIR") or "characteristics"),
        seed_dir=Path(env.get("SEED_DIR") or "data/seed"),
        database_url=env.get("DATABASE_URL") or DEFAULT_DATABASE_URL,
    )


def _choice[E: StrEnum](env: Mapping[str, str], name: str, kind: type[E], default: E) -> E:
    raw = env.get(name) or default.value
    try:
        return kind(raw)
    except ValueError:
        allowed = ", ".join(member.value for member in kind)
        raise ConfigError(f"{name}={raw!r} is not supported; use one of: {allowed}") from None


def _positive(env: Mapping[str, str], name: str, default: float) -> float:
    raw = env.get(name)
    if not raw:
        return default
    try:
        value = float(raw)
    except ValueError:
        raise ConfigError(f"{name}={raw!r} is not a number") from None
    if value <= 0:
        raise ConfigError(f"{name}={raw!r} must be positive")
    return value
