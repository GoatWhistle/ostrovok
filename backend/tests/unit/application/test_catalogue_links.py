from hotel_agent.application.agent.catalogue_links import reference_urls


def test_a_russian_wikipedia_tag_becomes_a_readable_article_address() -> None:
    urls = reference_urls({"wikipedia": "ru:Ритц-Карлтон Москва"})

    assert urls == [
        "https://ru.wikipedia.org/wiki/%D0%A0%D0%B8%D1%82%D1%86-%D0%9A%D0%B0%D1%80%D0%BB%D1%82%D0%BE%D0%BD_%D0%9C%D0%BE%D1%81%D0%BA%D0%B2%D0%B0"
    ]


def test_every_catalogue_reference_is_offered_once_and_in_order() -> None:
    urls = reference_urls(
        {
            "wikipedia": "en:Hotel National",
            "wikidata": "Q18399121",
            "website": "https://hotel.example/",
            "contact:website": "https://hotel.example/",
        }
    )

    assert urls == [
        "https://en.wikipedia.org/wiki/Hotel_National",
        "https://www.wikidata.org/wiki/Q18399121",
        "https://hotel.example/",
    ]


def test_tags_without_a_usable_reference_give_nothing() -> None:
    assert reference_urls({"wikipedia": "Ритц-Карлтон", "wikidata": "18399121"}) == []
    assert reference_urls({"website": "example.org"}) == []
    assert reference_urls({}) == []
