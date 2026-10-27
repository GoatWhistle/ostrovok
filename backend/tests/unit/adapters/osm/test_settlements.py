from pathlib import Path

from hotel_agent.adapters.osm.settlements import iter_settlement_batches

EXTRACT = """<?xml version='1.0' encoding='UTF-8'?>
<osm version="0.6" generator="test">
  <node id="1" lat="57.0034" lon="40.9869" version="1">
    <tag k="place" v="city"/><tag k="name" v="Иваново"/><tag k="population" v="401494"/>
  </node>
  <node id="2" lat="44.6473" lon="37.9404" version="1">
    <tag k="place" v="town"/><tag k="name" v="Кабардинка"/>
  </node>
  <node id="3" lat="55.7558" lon="37.6173" version="1">
    <tag k="place" v="city"/>
  </node>
  <node id="4" lat="55.7600" lon="37.6200" version="1">
    <tag k="place" v="locality"/><tag k="name" v="Урочище"/>
  </node>
  <node id="5" lat="55.7700" lon="37.6300" version="1">
    <tag k="amenity" v="bar"/><tag k="name" v="Якорь"/>
  </node>
</osm>
"""


def settlements(tmp_path: Path, batch_size: int = 5_000) -> list[tuple[str, dict[str, str]]]:
    extract = tmp_path / "places.osm"
    extract.write_text(EXTRACT, encoding="utf-8")
    return [
        (feature.id, feature.properties)
        for batch in iter_settlement_batches(extract, batch_size)
        for feature in batch.pois
    ]


def test_only_named_settlement_places_are_kept(tmp_path: Path) -> None:
    found = settlements(tmp_path)
    assert [item[0] for item in found] == ["n1", "n2"]
    assert found[0][1] == {"name": "Иваново", "place": "city", "population": "401494"}


def test_batches_are_split_without_losing_settlements(tmp_path: Path) -> None:
    assert len(settlements(tmp_path, batch_size=1)) == 2
