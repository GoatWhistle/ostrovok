from pathlib import Path

import httpx
import pytest

from hotel_agent.adapters.geo.osm_geometry import OSMViewGeometry, physical_objects
from hotel_agent.application.ports.view_geometry import PhysicalArea

XML = b"""<osm version="0.6">
<node id="1" lat="43" lon="39"/>
<node id="2" lat="43" lon="39.01"/>
<node id="3" lat="43.01" lon="39.01"/>
<node id="4" lat="43.01" lon="39"/>
<way id="10"><nd ref="1"/><nd ref="2"/><nd ref="3"/></way>
<way id="11"><nd ref="3"/><nd ref="4"/><nd ref="1"/></way>
<relation id="100"><member type="way" ref="10" role="outer"/>
<member type="way" ref="11" role="outer"/>
<tag k="type" v="multipolygon"/><tag k="building" v="cathedral"/>
<tag k="height" v="80"/><tag k="name" v="Cathedral"/></relation></osm>"""


def test_physical_relation_is_reconstructed_from_its_members() -> None:
    objects = physical_objects(XML)
    tags, geometry = objects["r100"]
    assert tags["building"] == "cathedral"
    assert tags["height"] == "80"
    assert geometry["type"] == "MultiPolygon"
    assert len(geometry["coordinates"][0][0]) == 5


async def test_geometry_cache_survives_restart_without_fabricating_a_missing_object(
    tmp_path: Path,
) -> None:
    requests = []

    def handle(request: httpx.Request) -> httpx.Response:
        requests.append(request.url.path)
        return httpx.Response(200, content=XML)

    source = OSMViewGeometry(tmp_path, httpx.MockTransport(handle))
    first = await source.object("r100")
    await source.aclose()
    source = OSMViewGeometry(tmp_path, httpx.MockTransport(handle))
    second = await source.object("r100")
    assert first is not None and second == first
    assert requests == ["/api/0.6/relation/100/full"]
    assert await source.object("r200") is None
    await source.aclose()


async def test_complete_map_area_includes_physical_relations_and_preserves_heights(
    tmp_path: Path,
) -> None:
    source = OSMViewGeometry(
        tmp_path, httpx.MockTransport(lambda request: httpx.Response(200, content=XML))
    )
    result = await source.area((39, 43, 39.01, 43.01))
    assert result is not None and result.complete
    assert result.buildings[0].id == "r100"
    assert result.buildings[0].tags["height"] == "80"
    await source.aclose()


@pytest.mark.parametrize("available", [True, False])
async def test_incomplete_disk_cache_uses_complete_geography_context(
    tmp_path: Path, available: bool
) -> None:
    bbox = (39.0, 43.0, 39.01, 43.01)
    payload = XML.replace(
        b'<member type="way" ref="11" role="outer"/>',
        b'<member type="way" ref="999" role="outer"/>',
    )
    (tmp_path / "area-39.000000-43.000000-39.010000-43.010000.osm").write_bytes(payload)
    calls: list[tuple[float, float, float, float]] = []
    complete = PhysicalArea(bbox, (), True, "local:complete-snapshot")

    class Context:
        async def area(
            self, bbox: tuple[float, float, float, float], region: str = "russia"
        ) -> PhysicalArea | None:
            calls.append(bbox)
            return complete if available else None

    source = OSMViewGeometry(
        tmp_path,
        httpx.MockTransport(lambda request: httpx.Response(503)),
        context=Context(),
    )
    result = await source.area(bbox)
    await source.aclose()
    assert result is not None
    assert result.complete is available
    if available:
        assert result == complete
    assert calls == [bbox]


@pytest.mark.parametrize("cached", [True, False])
async def test_all_cached_relations_are_recovered_beyond_download_limit(
    tmp_path: Path, cached: bool
) -> None:
    bbox = (39.0, 43.0, 39.01, 43.01)
    relations = []
    for identifier in range(100, 112):
        relations.append(
            f'<relation id="{identifier}"><member type="way" ref="999" role="outer"/>'
            '<tag k="type" v="multipolygon"/><tag k="building" v="yes"/></relation>'
        )
        if cached:
            (tmp_path / f"r{identifier}.osm").write_bytes(
                XML.replace(b'<relation id="100">', f'<relation id="{identifier}">'.encode())
            )
    payload = ('<osm version="0.6">' + "".join(relations) + "</osm>").encode()
    (tmp_path / "area-39.000000-43.000000-39.010000-43.010000.osm").write_bytes(payload)
    requests: list[httpx.Request] = []

    def handle(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(503)

    source = OSMViewGeometry(tmp_path, httpx.MockTransport(handle))
    result = await source.area(bbox)
    await source.aclose()
    assert result is not None and result.complete is cached
    assert len(result.buildings) == (12 if cached else 0)
    assert len(requests) == (0 if cached else 8)


async def test_unavailable_context_uses_osm_map_source(tmp_path: Path) -> None:
    class Context:
        async def area(
            self, bbox: tuple[float, float, float, float], region: str = "russia"
        ) -> PhysicalArea | None:
            return None

    calls: list[str] = []

    def handle(request: httpx.Request) -> httpx.Response:
        calls.append(request.url.path)
        return httpx.Response(200, content=XML)

    source = OSMViewGeometry(tmp_path, httpx.MockTransport(handle), context=Context())
    result = await source.area((39, 43, 39.01, 43.01))
    await source.aclose()
    assert result is not None and result.complete
    assert [building.id for building in result.buildings] == ["r100"]
    assert calls == ["/api/0.6/map"]
