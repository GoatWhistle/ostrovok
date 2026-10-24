from pathlib import Path

import pytest

from hotel_agent.adapters.osm.pbf_reader import read_region
from hotel_agent.application.dto import SeedLayers
from hotel_agent.application.ports.log import LogValue
from hotel_agent.domain.value_objects import BBox

BBOX = BBox(39.70, 43.55, 39.75, 43.60)

EXTRACT = """<?xml version='1.0' encoding='UTF-8'?>
<osm version="0.6" generator="test">
  <node id="1" lat="43.5700" lon="39.7100" version="1">
    <tag k="tourism" v="hotel"/><tag k="name" v="Приморская"/><tag k="stars" v="4"/>
  </node>
  <node id="2" lat="43.9000" lon="39.7100" version="1">
    <tag k="tourism" v="hotel"/><tag k="name" v="Далеко"/>
  </node>
  <node id="3" lat="43.5710" lon="39.7120" version="1">
    <tag k="amenity" v="bar"/><tag k="name" v="Якорь"/>
  </node>
  <node id="10" lat="43.5720" lon="39.7130" version="1"/>
  <node id="11" lat="43.5720" lon="39.7140" version="1"/>
  <node id="12" lat="43.5730" lon="39.7140" version="1"/>
  <node id="13" lat="43.5730" lon="39.7130" version="1"/>
  <node id="20" lat="43.5600" lon="39.7000" version="1"/>
  <node id="21" lat="43.5610" lon="39.7010" version="1"/>
  <way id="100" version="1">
    <nd ref="10"/><nd ref="11"/><nd ref="12"/><nd ref="13"/><nd ref="10"/>
    <tag k="building" v="hotel"/><tag k="building:levels" v="9"/><tag k="name" v="Корпус"/>
  </way>
  <way id="200" version="1">
    <nd ref="20"/><nd ref="21"/>
    <tag k="natural" v="coastline"/>
  </way>
  <way id="300" version="1">
    <nd ref="20"/><nd ref="21"/>
    <tag k="highway" v="primary"/><tag k="name" v="Курортный проспект"/>
  </way>
  <way id="400" version="1">
    <nd ref="20"/><nd ref="21"/>
    <tag k="highway" v="footway"/>
  </way>
  <way id="500" version="1">
    <nd ref="20"/><nd ref="21"/>
    <tag k="highway" v="footway"/><tag k="foot" v="no"/>
  </way>
</osm>
"""


class SilentLogger:
    def info(self, event: str, **fields: LogValue) -> None: ...

    def warning(self, event: str, **fields: LogValue) -> None: ...

    def error(
        self, event: str, *, exc: BaseException | None = None, **fields: LogValue
    ) -> None: ...


@pytest.fixture
def layers(tmp_path: Path) -> SeedLayers:
    extract = tmp_path / "sample.osm"
    extract.write_text(EXTRACT, encoding="utf-8")
    return read_region(extract, BBOX, SilentLogger())


def test_hotels_outside_the_bbox_are_left_out(layers: SeedLayers) -> None:
    names = {feature.properties.get("name") for feature in layers.hotels}

    assert "Приморская" in names
    assert "Далеко" not in names


def test_a_hotel_keeps_its_source_id_and_selected_tags(layers: SeedLayers) -> None:
    [hotel] = [item for item in layers.hotels if item.properties.get("name") == "Приморская"]

    assert hotel.id == "n1"
    assert hotel.properties == {"name": "Приморская", "tourism": "hotel", "stars": "4"}
    assert hotel.geometry == {"type": "Point", "coordinates": [39.71, 43.57]}


def test_a_closed_building_way_becomes_a_polygon_with_raw_tags(layers: SeedLayers) -> None:
    [building] = layers.buildings

    assert building.id == "w100"
    assert building.geometry["type"] == "MultiPolygon"
    assert building.properties["building:levels"] == "9"
    assert "height" not in building.properties


def test_lines_are_split_by_purpose(layers: SeedLayers) -> None:
    assert [item.id for item in layers.coastline] == ["w200"]
    assert [item.id for item in layers.noise_sources] == ["w300"]
    assert [item.id for item in layers.walk] == ["w300", "w400"]


def test_a_way_closed_to_pedestrians_is_not_walkable(layers: SeedLayers) -> None:
    assert "w500" not in {item.id for item in layers.walk}


def test_bars_are_collected_as_points(layers: SeedLayers) -> None:
    [bar] = layers.pois

    assert (bar.id, bar.properties["name"]) == ("n3", "Якорь")


def test_coordinates_are_rounded_to_centimetres(layers: SeedLayers) -> None:
    for feature in layers.buildings + layers.walk:
        for ring in feature.geometry["coordinates"]:
            for value in str(ring):
                assert value not in "e"
    [coast] = layers.coastline
    assert coast.geometry["coordinates"] == [[39.7, 43.56], [39.701, 43.561]]


def test_counts_name_every_layer(layers: SeedLayers) -> None:
    assert layers.counts() == {
        "hotels": 1,
        "buildings": 1,
        "pois": 1,
        "coastline": 1,
        "beaches": 0,
        "noise_sources": 1,
        "walk": 2,
    }
