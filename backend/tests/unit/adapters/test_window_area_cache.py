from pathlib import Path

from hotel_agent.adapters.geo.osm_geometry import OSMViewGeometry
from hotel_agent.application.ports.view_geometry import PhysicalArea


class UnavailableContext:
    def __init__(self) -> None:
        self.calls = 0

    async def area(
        self, bbox: tuple[float, float, float, float], region: str = "russia"
    ) -> PhysicalArea | None:
        self.calls += 1
        return None


async def test_existing_osm_area_cache_survives_geography_context_integration(
    tmp_path: Path,
) -> None:
    bbox = (30.305, 59.93, 30.31, 59.935)
    cached = tmp_path / "area-30.305000-59.930000-30.310000-59.935000.osm"
    cached.write_text('<osm version="0.6"></osm>')
    context = UnavailableContext()
    source = OSMViewGeometry(tmp_path, context=context)
    try:
        result = await source.area(bbox)
        assert result is not None
        assert result.complete
        assert context.calls == 0
    finally:
        await source.aclose()
