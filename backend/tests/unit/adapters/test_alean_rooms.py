import json
from collections.abc import Sequence
from datetime import UTC, datetime

import httpx

from hotel_agent.adapters.external.alean_rooms import card_details, card_rooms
from hotel_agent.adapters.external.alean_site import AleanRoomCard, card_url
from hotel_agent.application.ports.web_research import WebPage
from hotel_agent.domain.hotel_identity import HotelIdentity

CARD_URL = (
    "https://www.alean.ru/hotels/rossiya/krasnodarskiy_kray/"
    "sochi_gorod-kurort/sochi_tsentralnyy_rayon/ostrova_spa-otel/"
)
HOTEL = HotelIdentity(
    name="«Острова» СПА-отель",
    address="улица Пирогова, 10",
    location=(39.7094, 43.6062),
    city="Сочи",
)


def field(label: str, value: str) -> str:
    return (
        '<div class="productObjRooms-par"><table class="productTwoColsList">'
        '<tr class="productTwoColsList-listRow">'
        f'<td class="productTwoColsList-listCell productTwoColsList-firstCol">{label}</td>'
        '<td class="productTwoColsList-listCell productTwoColsList-lastCol">'
        f'<div class="productTwoColsList-level0"></div>'
        f'<div class="productTwoColsList-level1">{value}</div>'
        "</td></tr></table></div>"
    )


def section(title: str, *fields: str) -> str:
    return (
        f'<div class="productSection"><h3>{title}</h3>'
        f'<div class="productObjRooms">{"".join(fields)}</div></div>'
    )


def page(*sections: str, name: str = "«Острова» СПА-отель") -> str:
    record = {
        "@context": "https://schema.org",
        "@type": "Hotel",
        "name": name,
        "address": {"@type": "PostalAddress", "streetAddress": "ул. Пирогова, д.10"},
        "geo": {"@type": "GeoCoordinates", "latitude": 43.6062, "longitude": 39.7094},
        "starRating": {"@type": "Rating", "ratingValue": 4},
        "image": "https://uploads2.stells.info/x/952x600/jpg/a/bc/abc.jpg",
    }
    return (
        "<html><head>"
        f'<script type="application/ld+json">{json.dumps(record, ensure_ascii=False)}</script>'
        "</head><body>"
        '<div class="js-tabContent" id="descriptions">'
        + section("Документы", field("Для детей", "паспорт"))
        + "</div>"
        '<div class="js-tabContent" id="rooms">' + "".join(sections) + "</div>"
        '<div class="js-tabContent" id="treatment">'
        + section("методы лечения", field("Ингаляции", "щелочные"))
        + "</div></body></html>"
    )


SEA_ROOM = section(
    "Джуниор Сюит 2-местный 1-комнатный (4 этаж)",
    field("Вид из номера", "на парк: на море"),
    field("Этаж", "4"),
    field("Площадь (кв. м)", "33"),
    field("Кол-во основных мест", "2"),
    field("Кол-во доп. мест", "2"),
    field("Оборудование", "сейф</div><div>телевизор"),
)
PLAIN_ROOM = section(
    "Люкс 2-местный 2-комнатный (4 этаж)",
    field("Площадь (кв. м)", "50"),
    field("Кол-во основных мест", "2"),
)


def test_declared_view_floor_area_and_places_are_read_per_category() -> None:
    rooms = card_rooms(page(SEA_ROOM, PLAIN_ROOM))
    assert len(rooms) == 2
    sea, plain = rooms
    assert sea.views == ("sea", "park")
    assert sea.floor == 4
    assert sea.size_sqm == 33
    assert sea.main_places == 2
    assert sea.extra_places == 2
    assert "сейф" in sea.amenities
    assert plain.views == ()
    assert plain.floor == 4
    assert plain.extra_places is None


def test_rooms_outside_the_rooms_tab_are_not_categories() -> None:
    names = [room.name for room in card_rooms(page(SEA_ROOM))]
    assert names == ["Джуниор Сюит 2-местный 1-комнатный (4 этаж)"]


def test_card_without_room_fields_yields_no_categories() -> None:
    assert card_rooms(page(section("Акции", field("Скидка", "10%")))) == ()


def test_identity_comes_from_the_json_ld_hotel() -> None:
    details = card_details(page(SEA_ROOM), CARD_URL)
    assert details is not None
    assert details.name == "«Острова» СПА-отель"
    assert details.location == (39.7094, 43.6062)
    assert details.facts.star_rating == 4
    assert details.page_url == CARD_URL


def test_only_hotel_card_paths_are_followed() -> None:
    assert card_url(CARD_URL)
    assert not card_url("https://www.alean.ru/hotels/rossiya/")
    assert not card_url("https://example.test/hotels/rossiya/a/b/c/d/")


class Research:
    def __init__(self, urls: Sequence[str]) -> None:
        self._urls = urls

    async def search(self, query: str) -> Sequence[WebPage]:
        return [
            WebPage(url=url, title="Alean", text=query, retrieved_at=datetime.now(UTC))
            for url in self._urls
        ]

    async def read(self, url: str) -> WebPage:
        raise ValueError("Not used")


def transport(body: str, status: int = 200) -> httpx.MockTransport:
    def respond(request: httpx.Request) -> httpx.Response:
        assert request.url.host == "www.alean.ru"
        return httpx.Response(status, text=body)

    return httpx.MockTransport(respond)


async def test_matching_card_returns_rooms_with_views() -> None:
    async with httpx.AsyncClient(transport=transport(page(SEA_ROOM))) as client:
        lookup = AleanRoomCard(Research([CARD_URL]), client)
        found = await lookup.find(HOTEL)
        assert found is not None
        assert found.details.page_url == CARD_URL
        assert [room.views for room in found.rooms] == [("sea", "park")]
        await lookup.aclose()


async def test_another_hotel_on_the_page_is_rejected() -> None:
    async with httpx.AsyncClient(transport=transport(page(SEA_ROOM, name="Пансионат Дельфин"))) as (
        client
    ):
        lookup = AleanRoomCard(Research([CARD_URL]), client)
        assert await lookup.find(HOTEL) is None
        await lookup.aclose()


async def test_unreachable_card_is_not_an_error() -> None:
    async with httpx.AsyncClient(transport=transport("", status=500)) as client:
        lookup = AleanRoomCard(Research([CARD_URL]), client)
        assert await lookup.find(HOTEL) is None
        await lookup.aclose()


async def test_search_hits_outside_alean_are_ignored() -> None:
    async with httpx.AsyncClient(transport=transport(page(SEA_ROOM))) as client:
        lookup = AleanRoomCard(Research(["https://ostrovok.ru/hotel/russia/sochi/a/b/"]), client)
        assert await lookup.find(HOTEL) is None
        await lookup.aclose()
