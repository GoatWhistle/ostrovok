from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock, Mock

import pytest

from hotel_agent.application.agent.data_tools import DataTools
from hotel_agent.application.agent.wish_ledger import WishLedger
from hotel_agent.application.agent.wish_opening import open_wish


@pytest.mark.asyncio
async def test_partial_memory_does_not_skip_current_native_candidates() -> None:
    old = SimpleNamespace(hotel_id="old", value=True)
    nearest = SimpleNamespace(hotel_id="nearest", value=True)
    tools = SimpleNamespace(
        remembered=AsyncMock(return_value=(old,)),
        execute=AsyncMock(return_value={}),
        has_native=True,
        native_facts={"near square": (old, nearest)},
        native_required={},
        hotels=(),
        bbox=None,
    )
    result = await open_wish("near square", cast(DataTools, tools), Mock(spec=WishLedger), Mock())
    assert result.retained is not None
    assert {row.hotel_id for row in result.retained.facts} == {"old", "nearest"}
    tools.execute.assert_awaited_once_with("check_requested", {"term": "near square"})
