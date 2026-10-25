from datetime import UTC, datetime

from hotel_agent.application.dto import SupplierContentRecord
from hotel_agent.application.facility_matching import facility_fact, facility_intent
from hotel_agent.domain.query import FacilityRequest


def content() -> SupplierContentRecord:
    return SupplierContentRecord(
        hotel_id="hotel-1",
        supplier="nuitee",
        facilities_ru=("Открытый бассейн", "Бесплатный шведский стол для завтрака"),
        facilities_en=("Outdoor pool", "Free buffet breakfast"),
        updated_at=datetime(2026, 10, 25, tzinfo=UTC),
    )


def test_facility_request_matches_provider_label_without_a_predefined_field() -> None:
    request = FacilityRequest(term="шведский стол", source_text="со шведским столом")

    fact = facility_fact(request, content())

    assert fact is not None
    assert fact.value is True
    assert fact.source_type == "supplier"
    assert fact.qualifiers["facility"] == "Бесплатный шведский стол для завтрака"
    assert fact.characteristic_key == facility_intent(request).characteristic_key


def test_missing_facility_creates_no_positive_fact() -> None:
    request = FacilityRequest(term="сауна", source_text="с сауной")

    assert facility_fact(request, content()) is None


def test_available_paid_breakfast_does_not_prove_it_is_included() -> None:
    request = FacilityRequest(term="завтрак", source_text="с включённым завтраком")
    paid = SupplierContentRecord(
        hotel_id="hotel-1",
        supplier="nuitee",
        facilities_ru=("Завтрак доступен (за отдельную плату)",),
        facilities_en=(),
        updated_at=datetime(2026, 10, 25, tzinfo=UTC),
    )

    assert facility_fact(request, paid) is None
    assert facility_fact(request, content()) is not None
