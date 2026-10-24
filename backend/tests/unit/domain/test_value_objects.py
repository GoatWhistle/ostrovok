from datetime import UTC, datetime, timedelta

import pytest

from hotel_agent.domain.errors import InvalidValue
from hotel_agent.domain.value_objects import (
    Azimuth,
    BBox,
    Camera,
    Confidence,
    HotelId,
    LonLat,
    Subject,
    SubjectKind,
    Ttl,
    facade_id,
)

SOCHI = LonLat(39.7203, 43.5855)


@pytest.mark.parametrize(
    ("raw", "kind", "owner", "part"),
    [
        ("hotel:h_osm_w123", SubjectKind.HOTEL, "h_osm_w123", None),
        ("room:r_7", SubjectKind.ROOM, "r_7", None),
        ("facade:h_osm_w123:255", SubjectKind.FACADE, "h_osm_w123", "255"),
    ],
)
def test_subject_round_trips(raw: str, kind: SubjectKind, owner: str, part: str | None) -> None:
    subject = Subject.parse(raw)

    assert (subject.kind, subject.owner, subject.part) == (kind, owner, part)
    assert str(subject) == raw


@pytest.mark.parametrize(
    "raw",
    ["floor:3", "hotel:h_1:255", "facade:h_1", "facade:h_1:255:extra", "hotel:"],
)
def test_malformed_subject_is_rejected(raw: str) -> None:
    with pytest.raises(InvalidValue):
        Subject.parse(raw)


def test_facade_subject_and_id_agree() -> None:
    subject = Subject.facade(HotelId("h_1"), Azimuth(254.6))

    assert str(subject) == "facade:h_1:255"
    assert facade_id(HotelId("h_1"), Azimuth(254.6)) == "fc_h_1_255"


def test_opposite_azimuth_wraps() -> None:
    assert Azimuth(255.0).opposite().degrees == 75.0
    assert Azimuth(10.0).opposite().degrees == 190.0


@pytest.mark.parametrize("degrees", [-1.0, 360.0, 400.0])
def test_azimuth_outside_the_circle_is_rejected(degrees: float) -> None:
    with pytest.raises(InvalidValue, match="Azimuth"):
        Azimuth(degrees)


@pytest.mark.parametrize(("lon", "lat"), [(181.0, 43.0), (39.0, 91.0), (-181.0, 0.0)])
def test_coordinates_outside_the_globe_are_rejected(lon: float, lat: float) -> None:
    with pytest.raises(InvalidValue):
        LonLat(lon, lat)


def test_swapped_bbox_corners_are_rejected() -> None:
    with pytest.raises(InvalidValue, match="swapped"):
        BBox(40.0, 43.0, 39.0, 44.0)


@pytest.mark.parametrize("value", [-0.1, 1.1])
def test_confidence_outside_the_unit_range_is_rejected(value: float) -> None:
    with pytest.raises(InvalidValue, match="Confidence"):
        Confidence(value)


def test_scaled_confidence_stays_inside_the_unit_range() -> None:
    assert Confidence(0.8).scaled(2.0) == Confidence(1.0)
    assert Confidence(0.8).scaled(-1.0) == Confidence(0.0)


def test_ttl_expiry_is_computed_from_the_start() -> None:
    start = datetime(2026, 10, 24, tzinfo=UTC)

    assert Ttl(365).until(start) == start + timedelta(days=365)


def test_nonpositive_ttl_is_rejected() -> None:
    with pytest.raises(InvalidValue, match="TTL"):
        Ttl(0)


@pytest.mark.parametrize(("pitch", "bearing"), [(90.0, 0.0), (60.0, 360.0), (-1.0, 0.0)])
def test_impossible_camera_is_rejected(pitch: float, bearing: float) -> None:
    with pytest.raises(InvalidValue, match="Camera"):
        Camera(center=SOCHI, zoom=17.0, pitch=pitch, bearing=bearing)
