from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path

DEFAULT_DATABASE_URL = "postgresql://hotel:hotel@localhost:5432/hotel"


class LLMProvider(StrEnum):
    FAKE = "fake"
    ANTHROPIC = "anthropic"
    OPENAI_COMPAT = "openai_compat"


class HotelDataMode(StrEnum):
    FREE = "free"
    PARTNER = "partner"


class ConfigError(Exception):
    pass


@dataclass(frozen=True, slots=True)
class Settings:
    llm_provider: LLMProvider = LLMProvider.FAKE
    llm_api_key: str | None = None
    llm_base_url: str | None = None
    llm_model: str | None = None
    llm_fallback_model: str | None = None
    llm_timeout_s: float = 30.0
    map_catalog_dir: Path | None = None
    characteristics_dir: Path = Path("characteristics")
    seed_dir: Path = Path("data/seed")
    terrain_cache_dir: Path | None = None
    database_url: str = DEFAULT_DATABASE_URL
    etg_key_id: str | None = None
    etg_api_key: str | None = None
    etg_environment: str = "sandbox"
    nuitee_api_key: str | None = None
    hotel_data_mode: HotelDataMode = HotelDataMode.FREE
    ostrovok_site_enabled: bool = True
    public_data_user_agent: str = "HotelAgent/0.1 (https://github.com/GoatWhistle/o-hack)"
    geography_api_url: str = "https://overpass.private.coffee/api/interpreter"
    embedding_api_key: str | None = None
    embedding_model: str = "qwen/qwen3-embedding-8b"
    embedding_base_url: str = "https://polza.ai/api/v1"


def load_settings(env: Mapping[str, str]) -> Settings:
    return Settings(
        geography_api_url=env.get("GEOGRAPHY_API_URL")
        or "https://overpass.private.coffee/api/interpreter",
        public_data_user_agent=env.get("PUBLIC_DATA_USER_AGENT")
        or "HotelAgent/0.1 (https://github.com/GoatWhistle/o-hack)",
        map_catalog_dir=Path(env["MAP_CATALOG_DIR"]) if env.get("MAP_CATALOG_DIR") else None,
        terrain_cache_dir=Path(env["TERRAIN_CACHE_DIR"]) if env.get("TERRAIN_CACHE_DIR") else None,
        llm_provider=_choice(env, "LLM_PROVIDER", LLMProvider, LLMProvider.FAKE),
        llm_api_key=env.get("LLM_API_KEY") or None,
        llm_base_url=env.get("LLM_BASE_URL") or None,
        llm_model=env.get("LLM_MODEL") or None,
        llm_fallback_model=env.get("LLM_FALLBACK_MODEL") or None,
        llm_timeout_s=_positive(env, "LLM_TIMEOUT_S", 30.0),
        characteristics_dir=Path(env.get("CHARACTERISTICS_DIR") or "characteristics"),
        seed_dir=Path(env.get("SEED_DIR") or "data/seed"),
        database_url=env.get("DATABASE_URL") or DEFAULT_DATABASE_URL,
        etg_key_id=env.get("ETG_KEY_ID") or None,
        etg_api_key=env.get("ETG_API_KEY") or None,
        etg_environment=_etg_environment(env),
        nuitee_api_key=env.get("NUITEE_API_KEY") or None,
        hotel_data_mode=_choice(env, "HOTEL_DATA_MODE", HotelDataMode, HotelDataMode.FREE),
        ostrovok_site_enabled=_ostrovok_site_enabled(env),
        embedding_api_key=env.get("EMBEDDING_API_KEY") or None,
        embedding_model=env.get("EMBEDDING_MODEL") or "qwen/qwen3-embedding-8b",
        embedding_base_url=env.get("EMBEDDING_BASE_URL") or "https://polza.ai/api/v1",
    )


def _etg_environment(env: Mapping[str, str]) -> str:
    value = env.get("ETG_ENVIRONMENT") or "sandbox"
    if value not in {"sandbox", "production"}:
        raise ConfigError("ETG_ENVIRONMENT must be sandbox or production")
    if bool(env.get("ETG_KEY_ID")) != bool(env.get("ETG_API_KEY")):
        raise ConfigError("ETG_KEY_ID and ETG_API_KEY must be configured together")
    return value


def _ostrovok_site_enabled(env: Mapping[str, str]) -> bool:
    value = env.get("OSTROVOK_SITE") or "on"
    if value not in {"on", "off"}:
        raise ConfigError("OSTROVOK_SITE must be on or off")
    return value == "on"


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
