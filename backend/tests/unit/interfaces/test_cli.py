import pytest

from hotel_agent.domain.errors import InvalidValue
from hotel_agent.domain.value_objects import BBox
from hotel_agent.interfaces.cli.main import build_parser, parse_bbox


def test_the_default_region_is_sochi() -> None:
    args = build_parser().parse_args(
        ["build-seed", "--pbf", "a.pbf", "--dem", "d.tif", "--out", "out"]
    )

    assert args.region == "sochi"
    assert parse_bbox(args.bbox) == BBox(39.55, 43.35, 40.00, 43.75)


def test_several_dem_tiles_are_accepted() -> None:
    args = build_parser().parse_args(
        ["build-seed", "--pbf", "a.pbf", "--dem", "a.tif", "b.tif", "--out", "out"]
    )

    assert args.dem == ["a.tif", "b.tif"]


@pytest.mark.parametrize(
    ("raw", "message"),
    [
        ("39.55,43.35,40.00", "must read"),
        ("39.55,43.35,40.00,43.75,1", "must read"),
        ("39.55,43.35,west,43.75", "not a number"),
        ("40.00,43.35,39.55,43.75", "swapped"),
    ],
)
def test_a_broken_bbox_is_refused(raw: str, message: str) -> None:
    with pytest.raises(InvalidValue, match=message):
        parse_bbox(raw)


def test_a_command_is_required() -> None:
    with pytest.raises(SystemExit):
        build_parser().parse_args([])
