from dataclasses import dataclass, field

HEADROOM = 1.5
HEDGE_HEADROOM = 1.15
SWITCH_AFTER = 3


@dataclass(slots=True)
class AttemptBudget:
    ceiling_s: float
    observed: dict[str, float] = field(default_factory=dict)
    stalls: dict[str, int] = field(default_factory=dict)

    def timeout(self, model: str, *, initial: float) -> float:
        known = self.observed.get(model)
        if known is None:
            return min(initial, self.ceiling_s)
        return min(self.ceiling_s, max(initial, known * HEADROOM))

    def hedge_after(self, model: str, *, floor: float) -> float:
        known = self.observed.get(model)
        if known is None:
            return min(floor, self.ceiling_s)
        return min(self.ceiling_s, max(floor, known * HEDGE_HEADROOM))

    def answered(self, model: str, spent: float) -> None:
        known = self.observed.get(model)
        self.observed[model] = spent if known is None else (known + spent) / 2
        self.stalls[model] = 0

    def stalled(self, model: str, spent: float) -> None:
        self.stalls[model] = self.stalls.get(model, 0) + 1
        known = self.observed.get(model)
        self.observed[model] = spent if known is None else max(known, spent)

    def order(self, models: tuple[str, ...]) -> tuple[str, ...]:
        if len(models) < 2 or self.stalls.get(models[0], 0) < SWITCH_AFTER:
            return models
        spare = models[1]
        if spare == models[0] or self.stalls.get(spare, 0) >= SWITCH_AFTER:
            return models
        return (spare, models[0])
