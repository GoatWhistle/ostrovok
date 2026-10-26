from dataclasses import dataclass

from hotel_agent.application.ports.hotel_catalog import (
    CatalogMappingConflict,
    HotelCatalogSource,
    HotelCatalogStore,
)
from hotel_agent.application.ports.hotel_discovery import CatalogProviderFailure, HotelDiscoveryPort
from hotel_agent.application.ports.repositories import UnitOfWorkFactory
from hotel_agent.domain.errors import HotelNotFound
from hotel_agent.domain.hotel_identity import (
    HotelCandidate,
    HotelIdentity,
    IdentityAssessment,
    assess_identity,
)


@dataclass(frozen=True, slots=True, kw_only=True)
class CatalogMatch:
    hotel_id: str
    status: str
    supplier_id: str | None = None
    assessments: tuple[IdentityAssessment, ...] = ()
    imported_rooms: int | None = None


class MatchHotelCatalog:
    def __init__(
        self,
        uow: UnitOfWorkFactory,
        discovery: HotelDiscoveryPort,
        source: HotelCatalogSource,
        store: HotelCatalogStore,
    ) -> None:
        self._uow = uow
        self._discovery = discovery
        self._source = source
        self._store = store

    async def __call__(self, hotel_id: str, *, persist: bool = False) -> CatalogMatch:
        async with self._uow() as uow:
            hotel = await uow.search.get_hotel(hotel_id)
            if hotel is None:
                raise HotelNotFound()
            mapped = await uow.search.get_supplier_id(hotel_id, "nuitee")
        if mapped is not None:
            return CatalogMatch(hotel_id=hotel_id, status="already_mapped", supplier_id=mapped)
        identity = HotelIdentity(name=hotel.name, address=hotel.address, location=hotel.location)
        try:
            result = await self._discovery.nearby(identity.location)
        except CatalogProviderFailure:
            return CatalogMatch(hotel_id=hotel_id, status="provider_error")
        assessments = tuple(
            sorted(
                (assess_identity(identity, candidate) for candidate in result.candidates),
                key=lambda item: (not item.accepted, item.distance_m, item.candidate.supplier_id),
            )
        )
        accepted = [item.candidate for item in assessments if item.accepted]
        if not result.complete:
            status = "incomplete"
        elif len(accepted) > 1:
            status = "ambiguous"
        elif not accepted:
            status = "not_found"
        else:
            status = "matched"
        if status != "matched":
            return CatalogMatch(hotel_id=hotel_id, status=status, assessments=assessments)
        [candidate] = accepted
        if not persist:
            return CatalogMatch(
                hotel_id=hotel_id,
                status=status,
                supplier_id=candidate.supplier_id,
                assessments=assessments,
            )
        try:
            catalog = await self._source.get_hotel(candidate.supplier_id)
        except CatalogProviderFailure:
            return CatalogMatch(hotel_id=hotel_id, status="provider_error", assessments=assessments)
        if (
            catalog.supplier_id != candidate.supplier_id
            or catalog.identity is None
            or not assess_identity(
                identity, HotelCandidate(supplier_id=catalog.supplier_id, identity=catalog.identity)
            ).accepted
        ):
            return CatalogMatch(
                hotel_id=hotel_id, status="detail_mismatch", assessments=assessments
            )
        try:
            count = await self._store.save(hotel_id, catalog)
        except CatalogMappingConflict:
            return CatalogMatch(
                hotel_id=hotel_id, status="mapping_conflict", assessments=assessments
            )
        return CatalogMatch(
            hotel_id=hotel_id,
            status="imported",
            supplier_id=candidate.supplier_id,
            assessments=assessments,
            imported_rooms=count,
        )
