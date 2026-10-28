from datetime import datetime

from hotel_agent.application.dto import SearchFactRecord

FACTS = """SELECT h.id, f.id, f.characteristic_key, f.value, f.unit, f.qualifiers,
    f.source_type, f.source_id, f.method, f.confidence, f.computed_at, f.valid_until,
    f.status, f.geo_refs, f.explanation, NULL::double precision, f.subject_id,
    f.source_url, f.observed_at, f.evidence
FROM facts f JOIN hotels h ON h.id = f.subject_id
WHERE (%(region)s::text IS NULL OR h.region_id = %(region)s)
  AND (%(hotel_id)s::text IS NULL OR h.id = %(hotel_id)s) AND f.subject_type = 'hotel'
  AND (%(hotel_ids)s::text[] IS NULL OR h.id = ANY(%(hotel_ids)s::text[]))
  AND (%(characteristic_keys)s::text[] IS NULL OR f.characteristic_key=ANY(%(characteristic_keys)s::text[]))
  AND (f.status IN ('active', 'confirmed_by_hotelier')
       OR (%(characteristic_keys)s::text[] IS NULL AND %(hotel_ids)s::text[] IS NOT NULL AND f.status IN ('stale', 'conflicted')))
UNION ALL
SELECT fa.hotel_id, f.id, f.characteristic_key, f.value, f.unit, f.qualifiers,
    f.source_type, f.source_id, f.method, f.confidence, f.computed_at, f.valid_until,
    f.status, f.geo_refs, f.explanation, fa.azimuth_deg, f.subject_id,
    f.source_url, f.observed_at, f.evidence
FROM facts f JOIN facades fa ON fa.id = f.subject_id
JOIN hotels h ON h.id = fa.hotel_id
WHERE (%(region)s::text IS NULL OR h.region_id = %(region)s)
  AND (%(hotel_id)s::text IS NULL OR h.id = %(hotel_id)s) AND f.subject_type = 'facade'
  AND (%(hotel_ids)s::text[] IS NULL OR h.id = ANY(%(hotel_ids)s::text[]))
  AND (%(characteristic_keys)s::text[] IS NULL OR f.characteristic_key=ANY(%(characteristic_keys)s::text[]))
  AND (f.status IN ('active', 'confirmed_by_hotelier')
       OR (%(characteristic_keys)s::text[] IS NULL AND %(hotel_ids)s::text[] IS NOT NULL AND f.status IN ('stale', 'conflicted')))"""


def fact_record(row: tuple[object, ...]) -> SearchFactRecord:
    assert isinstance(row[10], datetime)
    assert row[11] is None or isinstance(row[11], datetime)
    return SearchFactRecord(
        hotel_id=str(row[0]),
        id=str(row[1]),
        characteristic_key=str(row[2]),
        value=row[3],
        unit=str(row[4]) if row[4] is not None else None,
        qualifiers=dict(row[5]) if isinstance(row[5], dict) else {},
        source_type=str(row[6]),
        source_id=str(row[7]) if row[7] is not None else None,
        method=str(row[8]),
        confidence=float(str(row[9])),
        computed_at=row[10],
        valid_until=row[11],
        status=str(row[12]),
        geo_refs=tuple(str(ref) for ref in row[13]) if isinstance(row[13], list | tuple) else (),
        explanation=str(row[14]),
        facade_azimuth=float(str(row[15])) if row[15] is not None else None,
        subject_id=str(row[16]) if row[16] is not None else None,
        source_url=str(row[17]) if row[17] is not None else None,
        observed_at=row[18] if isinstance(row[18], datetime) else None,
        evidence=_evidence(row[19]),
    )


def _evidence(raw: object) -> tuple[tuple[str, str], ...]:
    if not isinstance(raw, list):
        return ()
    return tuple(
        (str(item.get("kind", "quote")), str(item["text"]))
        for item in raw
        if isinstance(item, dict) and item.get("text")
    )


STALE_FACTS = """SELECT h.id, f.id, f.characteristic_key, f.value, f.unit, f.qualifiers,
    f.source_type, f.source_id, f.method, f.confidence, f.computed_at, f.valid_until,
    f.status, f.geo_refs, f.explanation, NULL::double precision, f.subject_id,
    f.source_url, f.observed_at, f.evidence
FROM facts f JOIN hotels h ON h.id = f.subject_id
WHERE h.region_id = %(region)s AND f.subject_type = 'hotel'
  AND f.characteristic_key = ANY(%(characteristic_keys)s::text[])
  AND f.status IN ('active', 'stale')
  AND f.valid_until IS NOT NULL AND f.valid_until <= %(now)s
ORDER BY f.valid_until
LIMIT %(limit)s"""

EXPIRING_FACTS = """SELECT h.id, f.id, f.characteristic_key, f.value, f.unit, f.qualifiers,
    f.source_type, f.source_id, f.method, f.confidence, f.computed_at, f.valid_until,
    f.status, f.geo_refs, f.explanation, NULL::double precision, f.subject_id,
    f.source_url, f.observed_at, f.evidence
FROM facts f JOIN hotels h ON h.id = f.subject_id
WHERE h.region_id = %(region)s AND f.subject_type = 'hotel'
  AND f.characteristic_key = ANY(%(characteristic_keys)s::text[])
  AND f.status IN ('active', 'stale', 'confirmed_by_hotelier')
  AND f.valid_until IS NOT NULL AND f.valid_until <= %(horizon)s
ORDER BY f.valid_until, f.id
LIMIT %(limit)s"""
