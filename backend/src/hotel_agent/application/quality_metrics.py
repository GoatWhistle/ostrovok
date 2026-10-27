from collections.abc import Sequence
from dataclasses import dataclass


@dataclass(frozen=True, slots=True, kw_only=True)
class CharacteristicMetric:
    characteristic_key: str
    hotels: int
    covered: int
    open_questions: int
    from_hotelier: int

    @property
    def coverage(self) -> float:
        return self.covered / self.hotels if self.hotels else 0.0

    @property
    def hotelier_share(self) -> float:
        known = self.covered
        return self.from_hotelier / known if known else 0.0


def overall_coverage(rows: Sequence[CharacteristicMetric]) -> float:
    if not rows:
        return 0.0
    return sum(row.coverage for row in rows) / len(rows)


def overall_hotelier_share(rows: Sequence[CharacteristicMetric]) -> float:
    covered = sum(row.covered for row in rows)
    return sum(row.from_hotelier for row in rows) / covered if covered else 0.0
