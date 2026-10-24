import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from hotel_agent.adapters.log.stdlib import StdlibLogger
from hotel_agent.application.use_cases.list_characteristics import ListCharacteristics
from hotel_agent.composition import build_providers
from hotel_agent.interfaces.http.app import api_router_v1
from hotel_agent.interfaces.http.errors import ErrorHandlers
from hotel_agent.settings import Settings, load_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    config = settings or load_settings(os.environ)
    logger = StdlibLogger("hotel_agent")
    providers = build_providers(config, logger)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.providers = providers
        try:
            yield
        finally:
            await providers.aclose()

    app = FastAPI(title="Hotel Agent API", version="0.1.0", lifespan=lifespan)
    ErrorHandlers(logger).register(app)
    app.include_router(
        api_router_v1(
            llm_provider=providers.llm.provider,
            list_characteristics=ListCharacteristics(providers.registry),
        )
    )
    return app
