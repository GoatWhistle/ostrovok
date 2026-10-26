from pathlib import Path

import pytest

from hotel_agent.adapters.log.stdlib import StdlibLogger
from hotel_agent.adapters.osm.geography_snapshot import parse_snapshot
from hotel_agent.adapters.osm.hotel_tags import iter_hotel_tags
from hotel_agent.adapters.osm.pbf_stream import iter_region_batches
from hotel_agent.adapters.osm.polygon_extract import prepare_polygon_extract
from hotel_agent.domain.value_objects import BBox

EXTRACT = Path(__file__).resolve().parents[3] / "fixtures/geography.osm"
BBOX = (10.0, 50.0, 10.005, 50.005)


def test_snapshot_preserves_details_and_assembles_building_parts_and_beach_relations() -> None:
    snapshot = parse_snapshot(EXTRACT.read_bytes(), BBOX, "https://example.test/api")
    assert snapshot.complete
    assert {item.id for item in snapshot.layers.buildings} == {"w10", "w11"}
    assert [item.id for item in snapshot.layers.beaches] == ["r20"]
    assert [item.id for item in snapshot.layers.walk] == ["w13"]
    assert [item.id for item in snapshot.layers.noise_sources] == ["w14"]
    [hotel] = snapshot.layers.hotels
    assert hotel.properties["breakfast"] == "yes"
    assert hotel.properties["wheelchair"] == "yes"
    assert snapshot.layers.buildings[0].properties["roof:height"] == "3"


def test_missing_relation_geometry_never_becomes_complete_coverage() -> None:
    payload = EXTRACT.read_bytes().replace(
        b'<member type="way" ref="12"', b'<member type="way" ref="999"'
    )
    snapshot = parse_snapshot(payload, BBOX, "https://example.test/api")
    assert not snapshot.complete
    assert snapshot.layers.beaches == []


@pytest.mark.parametrize("payload", [b"<html/>", b"<osm><remark>timeout</remark></osm>"])
def test_failed_api_document_is_not_a_successful_empty_region(payload: bytes) -> None:
    with pytest.raises(ValueError):
        parse_snapshot(payload, BBOX, "https://example.test/api")


def test_separate_beach_import_retains_multipolygon_relations() -> None:
    batches = list(
        iter_region_batches(
            EXTRACT, BBox(*BBOX), StdlibLogger("polygon-test"), frozenset({"beaches"})
        )
    )
    assert [item.id for batch in batches for item in batch.beaches] == ["r20"]
    assert all(not batch.hotels and not batch.buildings for batch in batches)


def test_full_polygon_import_with_disk_index_preserves_parts_and_height_details(
    tmp_path: Path,
) -> None:
    batches = list(
        iter_region_batches(
            EXTRACT,
            BBox(*BBOX),
            StdlibLogger("polygon-test"),
            frozenset({"buildings", "beaches"}),
            location_index=f"sparse_file_array,{tmp_path / 'nodes.idx'}",
        )
    )
    buildings = {item.id: item for batch in batches for item in batch.buildings}
    assert set(buildings) == {"w10", "w11"}
    assert buildings["w10"].properties["roof:height"] == "3"
    assert buildings["w11"].properties["height"] == "30 m"
    assert [item.id for batch in batches for item in batch.beaches] == ["r20"]


def test_hotel_tag_refresh_needs_no_node_index_and_keeps_nonstandard_details() -> None:
    [hotel] = list(iter_hotel_tags(EXTRACT))
    assert hotel.id == "n5"
    assert hotel.tags["breakfast"] == "yes"
    assert hotel.tags["wheelchair"] == "yes"


def test_filtered_extract_keeps_referenced_nodes_and_relation_members(tmp_path: Path) -> None:
    target = tmp_path / "polygons.osm.pbf"
    assert prepare_polygon_extract(EXTRACT, target) == 3
    batches = list(
        iter_region_batches(
            target,
            BBox(*BBOX),
            StdlibLogger("polygon-test"),
            frozenset({"buildings", "beaches"}),
        )
    )
    assert {item.id for batch in batches for item in batch.buildings} == {"w10", "w11"}
    assert {item.id for batch in batches for item in batch.beaches} == {"r20"}
