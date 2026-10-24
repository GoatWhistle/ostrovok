from collections.abc import Sequence
from typing import Protocol

from hotel_agent.domain.characteristics import Characteristic


class CharacteristicRegistryPort(Protocol):
    def all(self) -> Sequence[Characteristic]: ...

    def get(self, key: str) -> Characteristic: ...
