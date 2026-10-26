from datetime import datetime

from hotel_agent.application.dto import SearchFactRecord


def search_fact(row: tuple[object, ...]) -> SearchFactRecord:
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
    )
