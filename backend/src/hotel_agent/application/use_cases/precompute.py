from collections.abc import Mapping

from hotel_agent.application.ports.precompute import PrecomputePort


class Precompute:
    def __init__(self, calculator: PrecomputePort) -> None:
        self._calculator = calculator

    async def __call__(self, region: str) -> Mapping[str, int]:
        return await self._calculator.run(region)
