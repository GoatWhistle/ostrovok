from typing import Any, Protocol


class Completion(Protocol):
    @property
    def provider(self) -> str: ...

    async def complete(
        self,
        *,
        system: str,
        user: str,
        schema: dict[str, Any] | None = None,
        planning: bool = False,
    ) -> str: ...

    async def aclose(self) -> None: ...
