from collections.abc import Sequence

from hotel_agent.application.ports.registry import CharacteristicRegistryPort
from hotel_agent.domain.characteristics import Characteristic


class ListCharacteristics:
    def __init__(self, registry: CharacteristicRegistryPort) -> None:
        self._registry = registry

    def __call__(self) -> Sequence[Characteristic]:
        return self._registry.all()
