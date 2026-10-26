from pathlib import Path

import httpx

from hotel_agent.adapters.geo.osm_geometry import OSMViewGeometry, physical_objects

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
