from collections.abc import Callable
from contextvars import ContextVar, Token
from time import perf_counter

from hotel_agent.application.ports.log import LoggerPort

Report = Callable[[str, dict[str, object]], None]

_channel: ContextVar[Report | None] = ContextVar("search_progress", default=None)
_clock: ContextVar[tuple[str, float] | None] = ContextVar("search_stage_clock", default=None)
_timers: list[LoggerPort] = []


def time_stages(logger: LoggerPort) -> None:
    _timers[:] = [logger]


def listen(report: Report) -> Token[Report | None]:
    return _channel.set(report)


def release(token: Token[Report | None]) -> None:
    _channel.reset(token)


def mark(stage: str) -> None:
    now = perf_counter()
    previous = _clock.get()
    _clock.set(None if stage == "done" else (stage, now))
    if previous is None or not _timers:
        return
    name, started = previous
    _timers[0].info("chat_stage", stage=name, seconds=round(now - started, 2), next=stage)


def step(stage: str, **fields: object) -> None:
    mark(stage)
    report = _channel.get()
    if report is not None:
        report(stage, fields)
