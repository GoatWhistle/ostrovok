from hotel_agent.adapters.db.hotel_media import read_hotel_photos


def test_media_keep_supplier_order_sources_and_osm_fallback() -> None:
    photos = read_hotel_photos(
        {"image": "https://media.example/osm.jpg"},
        [
            {
                "source_url": "https://hotel.example/gallery",
                "photos": [
                    {"url": "https://media.example/one.jpg", "kind": "surroundings"},
                    "https://media.example/two.jpg",
                ],
            },
            {"hotelImages": [{"urlHd": "https://media.example/one.jpg"}]},
        ],
        "n123",
    )
    assert [photo.url for photo in photos] == [
        "https://media.example/one.jpg",
        "https://media.example/two.jpg",
        "https://media.example/osm.jpg",
    ]
    assert photos[0].kind == "surroundings"
    assert photos[0].source_url == "https://hotel.example/gallery"
    assert photos[2].source_url == "https://www.openstreetmap.org/node/123"


def test_media_reject_invalid_protocol_credentials_and_malformed_records() -> None:
    values: list[object] = [
        None,
        7,
        [],
        {},
        "javascript:alert(1)",
        "data:image/png,x",
        "https://user:secret@media.example/a.jpg",
        "https://[invalid",
        "https://a\n/b",
        {"url": "https://media.example/one.jpg", "kind": []},
    ]
    assert read_hotel_photos({}, [{"photos": values}], "test") == ()
    assert read_hotel_photos(None, None, "test") == ()


def test_media_limit_deduplicated_photos() -> None:
    photos = read_hotel_photos(
        {}, [{"photos": [f"https://example.org/{n}.jpg" for n in range(40)]}], "test"
    )
    assert len(photos) == 24
