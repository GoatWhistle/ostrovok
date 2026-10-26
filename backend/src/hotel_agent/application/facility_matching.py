import hashlib
import re
from datetime import timedelta

from hotel_agent.application.dto import SearchFactRecord, SupplierContentRecord
from hotel_agent.domain.characteristics import Op
from hotel_agent.domain.query import FacilityRequest, Intent


def facility_key(request: FacilityRequest) -> str:
    term = _normalize(request.term)
    return f"facility:{hashlib.sha256(term.encode()).hexdigest()[:12]}"


def facility_intent(request: FacilityRequest) -> Intent:
    return Intent(
        characteristic_key=facility_key(request),
        op=Op.EQ,
        value=True,
        weight=1.0,
        required=request.required,
        source_text=request.source_text,
    )


def facility_fact(
    request: FacilityRequest, content: SupplierContentRecord
) -> SearchFactRecord | None:
    term = _normalize(request.term)
    names = content.facilities_ru + content.facilities_en
    included = any(
        marker in _normalize(request.source_text)
        for marker in ("включ", "бесплат", "included", "free")
    )
    found = next(
        (name for name in names if term in _normalize(name) and (not included or _included(name))),
        None,
    )
    if found is None:
        return None
    key = facility_key(request)
    digest = key.removeprefix("facility:")
    return SearchFactRecord(
        hotel_id=content.hotel_id,
        id=f"f_facility_{content.hotel_id}_{digest}",
        characteristic_key=key,
        value=True,
        unit=None,
        qualifiers={"facility": found, "source_text": request.source_text},
        source_type="supplier",
        source_id=content.supplier,
        method="supplier_facility@1",
        confidence=0.85,
        computed_at=content.updated_at,
        valid_until=content.updated_at + timedelta(days=90),
        status="active",
        geo_refs=(),
        explanation=f"В каталоге {content.supplier}: {found}",
        facade_azimuth=None,
    )


def _normalize(value: str) -> str:
    return re.sub(r"\s+", " ", value.casefold().replace("ё", "е")).strip()


def _included(name: str) -> bool:
    normalized = _normalize(name)
    paid = {"платный", "платная", "платное", "платно", "плату", "оплачивается"}
    if paid.intersection(re.findall(r"\w+", normalized)) or any(
        marker in normalized for marker in ("не включ", "not included", "surcharge", "extra charge")
    ):
        return False
    return any(marker in normalized for marker in ("бесплат", "включ", "free", "included"))
