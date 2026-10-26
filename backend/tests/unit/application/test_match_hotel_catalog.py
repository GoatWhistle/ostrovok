from dataclasses import replace
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock, MagicMock

import pytest

from hotel_agent.application.dto import SearchHotelRecord
from hotel_agent.application.ports.hotel_catalog import CatalogHotel, CatalogMappingConflict
from hotel_agent.application.ports.hotel_discovery import CatalogProviderFailure, DiscoveryResult
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.application.use_cases.match_hotel_catalog import MatchHotelCatalog
from hotel_agent.domain.errors import HotelNotFound
from hotel_agent.domain.hotel_identity import HotelCandidate, HotelIdentity

IDENTITY = HotelIdentity(name="Маринс Парк", address="Морская 12", location=(39.72, 43.58))
CANDIDATE = HotelCandidate(supplier_id="supplier-1", identity=IDENTITY)
LOCAL = SearchHotelRecord(
    id="local-1",
    region_id="sochi",
    name=IDENTITY.name,
    address=IDENTITY.address,
    location=IDENTITY.location,
    stars=None,
    building_id=None,
    height_m=None,
    levels=None,
    footprint=None,
)


def make_matcher(
    *,
    candidates: tuple[HotelCandidate, ...] = (CANDIDATE,),
    complete: bool = True,
    mapped: str | None = None,
) -> tuple[MatchHotelCatalog, SimpleNamespace]:
    search = SimpleNamespace(
        get_hotel=AsyncMock(return_value=LOCAL), get_supplier_id=AsyncMock(return_value=mapped)
    )
    scope = MagicMock()
    scope.__aenter__ = AsyncMock(return_value=SimpleNamespace(search=search))
    scope.__aexit__ = AsyncMock(return_value=None)
    discovery = SimpleNamespace(
        nearby=AsyncMock(return_value=DiscoveryResult(candidates, complete))
    )
    source = SimpleNamespace(
        get_hotel=AsyncMock(
            return_value=CatalogHotel(
                supplier_id="supplier-1",
                name=IDENTITY.name,
                rooms=(),
                identity=IDENTITY,
            )
        )
    )
    store = SimpleNamespace(save=AsyncMock(return_value=3))
    matcher = MatchHotelCatalog(cast(UnitOfWorkFactory, lambda: scope), discovery, source, store)
    return matcher, SimpleNamespace(
        search=search, scope=scope, discovery=discovery, source=source, store=store
    )


async def test_read_only_matching_closes_database_before_provider_and_does_not_import() -> None:
    matcher, deps = make_matcher()

    async def lookup(location: tuple[float, float]) -> DiscoveryResult:
        deps.scope.__aexit__.assert_awaited_once()
        assert location == IDENTITY.location
        return DiscoveryResult((CANDIDATE,), True)

    deps.discovery.nearby.side_effect = lookup
    result = await matcher("local-1")
    assert result.status == "matched" and result.supplier_id == "supplier-1"
    deps.source.get_hotel.assert_not_called()
    deps.store.save.assert_not_called()


async def test_unique_match_is_rechecked_before_import() -> None:
    matcher, deps = make_matcher()
    result = await matcher("local-1", persist=True)
    assert result.status == "imported" and result.imported_rooms == 3
    deps.source.get_hotel.assert_awaited_once_with("supplier-1")
    deps.store.save.assert_awaited_once_with("local-1", deps.source.get_hotel.return_value)


@pytest.mark.parametrize(
    ("candidates", "complete", "status"),
    [
        ((), True, "not_found"),
        ((CANDIDATE, replace(CANDIDATE, supplier_id="supplier-2")), True, "ambiguous"),
        ((CANDIDATE,), False, "incomplete"),
    ],
)
async def test_uncertain_catalog_never_writes(
    candidates: tuple[HotelCandidate, ...],
    complete: bool,
    status: str,
) -> None:
    matcher, deps = make_matcher(candidates=candidates, complete=complete)
    result = await matcher("local-1", persist=True)
    assert result.status == status and result.supplier_id is None
    deps.source.get_hotel.assert_not_called()
    deps.store.save.assert_not_called()


@pytest.mark.parametrize(
    "identity",
    [None, replace(IDENTITY, address="Морская 13"), replace(IDENTITY, location=(37.62, 55.75))],
)
async def test_inconsistent_detail_never_imports(identity: HotelIdentity | None) -> None:
    matcher, deps = make_matcher()
    deps.source.get_hotel.return_value = CatalogHotel(
        supplier_id="supplier-1",
        name=IDENTITY.name,
        rooms=(),
        identity=identity,
    )
    result = await matcher("local-1", persist=True)
    assert result.status == "detail_mismatch"
    deps.store.save.assert_not_called()


async def test_existing_mapping_avoids_discovery() -> None:
    matcher, deps = make_matcher(mapped="known-id")
    result = await matcher("local-1", persist=True)
    assert result.status == "already_mapped" and result.supplier_id == "known-id"
    deps.discovery.nearby.assert_not_called()
    deps.store.save.assert_not_called()


async def test_missing_local_hotel_fails_before_external_calls() -> None:
    matcher, deps = make_matcher()
    deps.search.get_hotel.return_value = None
    with pytest.raises(HotelNotFound):
        await matcher("missing")
    deps.discovery.nearby.assert_not_called()


@pytest.mark.parametrize("phase", ["discovery", "detail"])
async def test_provider_failures_are_unknown_not_an_empty_inventory(phase: str) -> None:
    matcher, deps = make_matcher()
    target = deps.discovery.nearby if phase == "discovery" else deps.source.get_hotel
    target.side_effect = CatalogProviderFailure("failed")
    result = await matcher("local-1", persist=True)
    assert result.status == "provider_error"
    deps.store.save.assert_not_called()


async def test_supplier_id_conflict_is_an_explicit_non_match() -> None:
    matcher, deps = make_matcher()
    deps.store.save.side_effect = CatalogMappingConflict()
    result = await matcher("local-1", persist=True)
    assert result.status == "mapping_conflict" and result.supplier_id is None
