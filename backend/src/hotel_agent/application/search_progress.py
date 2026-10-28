from hotel_agent.application import progress
from hotel_agent.application.search_candidates import Candidates
from hotel_agent.domain.query import ParsedQuery


def report_candidates(candidates: Candidates, location: str | None) -> None:
    hotels = candidates.hotels
    bbox = candidates.bbox
    if bbox is None and hotels:
        longitudes = [h.location[0] for h in hotels]
        latitudes = [h.location[1] for h in hotels]
        bbox = (min(longitudes), min(latitudes), max(longitudes), max(latitudes))
    progress.step(
        "candidates",
        found=len(hotels),
        region=candidates.region,
        location=location,
        bbox=bbox,
        unsupported=candidates.unsupported,
        hotels=[
            {"id": h.id, "name": h.name, "location": h.location, "rating": h.rating}
            for h in sorted(hotels, key=lambda h: -(h.rating or 0))
        ],
    )


def understood(parsed: ParsedQuery, location: str | None) -> dict[str, object]:
    return {
        "location": location,
        "route_search": any(not request.avoid for request in parsed.nearby_objects)
        or any(request.kind == "landmark_nearby" for request in parsed.spatial_requests),
        "intents": [
            {"term": intent.source_text.strip(), "key": intent.characteristic_key}
            for intent in parsed.intents
            if intent.source_text.strip()
        ],
        "check_in": parsed.check_in.isoformat() if parsed.check_in else None,
        "check_out": parsed.check_out.isoformat() if parsed.check_out else None,
        "adults": parsed.adults,
    }
