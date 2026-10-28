from datetime import UTC, datetime
from unittest.mock import MagicMock

from hotel_agent.application.agent.data_evidence import materialize
from hotel_agent.application.agent.data_records import DataCheck, DataCriterion
from hotel_agent.application.agent.data_tools import DataTools
from hotel_agent.application.agent.evidence_summary import MAX_LENGTH, brief, measured, sources
from hotel_agent.application.dto import SearchHotelRecord

NOW = datetime(2026, 10, 28, tzinfo=UTC)
TRUMP_QUOTE = (
    "во время визита в Москву в 2013 году предприниматель поселился в отеле «Ритц-Карлтон» "
    "в том же номере, где останавливались Барак и Мишель Обама"
)


def hotel(identifier: str, name: str) -> SearchHotelRecord:
    return SearchHotelRecord(
        id=identifier,
        region_id="russia",
        name=name,
        location=(37.61, 55.75),
        stars=None,
        building_id=None,
        height_m=None,
        levels=None,
        footprint=None,
    )


def tools_with(record: SearchHotelRecord) -> DataTools:
    tools = DataTools(MagicMock(), MagicMock(), [record], "Москва", "russia", None, False)
    tools.hotels = (record,)
    return tools


def criterion(term: str, *checks: DataCheck) -> DataCriterion:
    return DataCriterion(term=term, source_text=term, checks=checks, required=False, explanation="")


def test_event_explanation_names_the_event_the_date_and_the_distance() -> None:
    record = hotel("n1", "HotelHot")
    tools = tools_with(record)
    tools.metrics["n1"] = {"event1.match_count": 1.0}
    tools.descriptions["event1.match_count"] = (
        "Проверенных событий: Кишлак — MTC Live Холл, 2026-11-22"
    )
    tools.reader.quotes["n1"] = {"event1.match_count": ("Событие «Кишлак» на площадке",)}
    tools.reader.source_urls["n1"] = {
        "event1.match_count": ("https://afisha.yandex.ru/moscow/concert/kishlak-2026-11",)
    }
    tools.places.events.append(
        {
            "hotel_id": "n1",
            "title": "Кишлак",
            "place": "MTC Live Холл",
            "start": "2026-11-22T19:00:00+03:00",
            "distance_m": 989.6,
        }
    )
    outcome = materialize(
        "хочу снять отель неподалеку от концерта кишлака в москве",
        ("концерта кишлака",),
        (criterion("концерта кишлака", DataCheck(field="event1.match_count", op="gte", value=1)),),
        tools,
        NOW,
        None,
    )

    assert outcome.facts[0].explanation == (
        "Кишлак, MTC Live Холл, 2026-11-22, 990 м до площадки. Источник: afisha.yandex.ru."
    )


def test_source_confirmation_keeps_one_trimmed_quote_and_the_source_host() -> None:
    record = hotel("w31482145", "The Carlton Moscow")
    tools = tools_with(record)
    tools.metrics["w31482145"] = {"r1.match_count": 1.0}
    tools.descriptions["r1.match_count"] = "Подтверждений в данных источника"
    tools.reader.quotes["w31482145"] = {"r1.match_count": (TRUMP_QUOTE,)}
    tools.reader.source_urls["w31482145"] = {
        "r1.match_count": ("https://meduza.io/feature/2017/01/11/buzzfeed",)
    }
    term = "в котором останавливался трамп"
    outcome = materialize(
        "хочу отель в москве, в котором останавливался трамп",
        (term,),
        (criterion(term, DataCheck(field="r1.match_count", op="gte", value=1)),),
        tools,
        NOW,
        None,
    )

    explanation = outcome.facts[0].explanation
    assert len(explanation) <= MAX_LENGTH
    assert explanation.startswith("Подтверждено: «во время визита в Москву в 2013 году")
    assert explanation.endswith("Источник: meduza.io.")
    assert outcome.facts[0].qualifiers["source_quotes"] == [TRUMP_QUOTE]


def test_measured_conditions_state_the_value_and_the_threshold_once() -> None:
    record = hotel("m1", "Mountain")
    tools = tools_with(record)
    tools.metrics["m1"] = {"m1.elevation_m": 1500.0, "m1.relief_m": 700.0}
    tools.descriptions["m1.elevation_m"] = "Высота над уровнем моря, м"
    tools.descriptions["m1.relief_m"] = "Перепад высот вокруг отеля, м"
    outcome = materialize(
        "хочу отель высоко в горах",
        ("высоко в горах",),
        (
            criterion(
                "высоко в горах",
                DataCheck(field="m1.elevation_m", op="gte", value=900),
                DataCheck(field="m1.relief_m", op="gte", value=200),
            ),
        ),
        tools,
        NOW,
        None,
    )

    assert outcome.facts[0].explanation == (
        "Высота над уровнем моря, м: 1500 (нужно не менее 900). "
        "Перепад высот вокруг отеля, м: 700 (нужно не менее 200). "
        "Рельеф по Copernicus GLO-30, не вид из номера."
    )


def test_unmeasured_wish_reason_is_cut_to_the_first_whole_sentences() -> None:
    reason = (
        "Проверил афишу и общий поиск. " * 9
    ) + "Подтверждений не нашлось, это не доказывает отсутствие."

    assert len(brief(reason)) <= MAX_LENGTH
    assert brief(reason).endswith(".")
    assert "…" not in brief(reason)


def test_sources_show_hosts_without_tracking_tails() -> None:
    assert sources(("https://www.afisha.yandex.ru/a?b=1", "https://ru.wikipedia.org/wiki/x")) == (
        "Источники: afisha.yandex.ru, ru.wikipedia.org"
    )
    assert measured("Подтверждений в данных источника", 1, "gte", 1) == "Подтверждено источником"
