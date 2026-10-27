from collections.abc import Callable
from contextvars import ContextVar, Token

Report = Callable[[str, dict[str, object]], None]

_channel: ContextVar[Report | None] = ContextVar("search_progress", default=None)


def listen(report: Report) -> Token[Report | None]:
    return _channel.set(report)


def release(token: Token[Report | None]) -> None:
    _channel.reset(token)


def step(stage: str, **fields: object) -> None:
    report = _channel.get()
    if report is not None:
        report(stage, fields)
