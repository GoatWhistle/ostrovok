from contextlib import asynccontextmanager
from dataclasses import replace
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock

import pytest

from hotel_agent.adapters.geo.window_reports import window_evidence
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.ports.window_views import (
    PreparedViews,
    WindowEvidence,
    WindowViewsPort,
)
from hotel_agent.application.use_cases.evaluate_window_views import EvaluateWindowViews
from tests.unit.adapters.test_window_views import hotel, request
from tests.unit.application.test_data_explorer import NOW


@pytest.mark.parametrize("already_visible", [False, True])
async def test_refine_empty_broad_search(already_visible: bool) -> None:
    hotels = tuple(replace(hotel(), id=f"h{i}") for i in range(12))
    wanted = request()
    initial = tuple(
        replace(
            window_evidence(h.id, wanted, NOW, None, "budget limited")[0],
            qualifiers={"visibility": {"calculation_attempted": True, "distance_m": i + 10}},
        )
        for i, h in enumerate(hotels)
    )
    if already_visible:
        initial = (replace(initial[0], value=True), *initial[1:])
    confirmed = replace(initial[7], value=True, explanation="Clear line with detailed sampling")
    views = SimpleNamespace(
        prepare=AsyncMock(
            side_effect=lambda hs, *args: PreparedViews(wanted, tuple(hs), (), {}, (), ())
        ),
        evaluate=AsyncMock(
            side_effect=[WindowEvidence(initial, ()), WindowEvidence((confirmed,), ())]
        ),
    )
    scenes = SimpleNamespace(
        hotel_buildings=AsyncMock(return_value={}), path_buildings=AsyncMock(return_value={})
    )

    @asynccontextmanager
    async def uow() -> Any:
        yield SimpleNamespace(view_scenes=scenes)

    result = await EvaluateWindowViews(cast(UnitOfWorkFactory, uow), cast(WindowViewsPort, views))(
        hotels, wanted, {}, NOW
    )
    expected = "h0" if already_visible else "h7"
    assert next(f for f in result.facts if f.hotel_id == expected).value is True
    assert {f.hotel_id for f in result.facts} == {h.id for h in hotels}
    assert views.prepare.call_count == (1 if already_visible else 2)
    if not already_visible:
        assert len(views.prepare.call_args_list[1].args[0]) == 8
