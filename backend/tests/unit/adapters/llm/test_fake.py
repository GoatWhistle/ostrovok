from pathlib import Path

import pytest

from hotel_agent.adapters.llm.fake import FakeLLM
from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry
from hotel_agent.domain.characteristics import Op


@pytest.fixture
def llm(characteristics_dir: Path) -> FakeLLM:
    return FakeLLM(YamlCharacteristicRegistry.from_directory(characteristics_dir))


async def test_demo_query_becomes_intents(llm: FakeLLM) -> None:
    parsed = await llm.parse_query("тихий номер с видом на закат недалеко от моря")

    assert [(intent.characteristic_key, intent.op, intent.value) for intent in parsed.intents] == [
        ("noise_level", Op.LTE, 3.0),
        ("sunset_view", Op.EQ, True),
        ("distance_to_sea", Op.LTE, 10.0),
    ]


async def test_unknown_words_are_kept(llm: FakeLLM) -> None:
    parsed = await llm.parse_query("тихий номер с балконом и сауной")

    assert parsed.unmatched_terms == ("номер", "балконом", "сауной")
    assert [intent.characteristic_key for intent in parsed.intents] == ["noise_level"]


async def test_longest_phrase_wins(llm: FakeLLM) -> None:
    parsed = await llm.parse_query("хочу очень тихий номер")

    [intent] = parsed.intents
    assert (intent.source_text, intent.value) == ("очень тихий", 2.0)


async def test_parsing_is_deterministic(llm: FakeLLM) -> None:
    first = await llm.parse_query("Тихий номер у самого моря")
    second = await llm.parse_query("тихий номер у самого моря")

    assert first == second


async def test_offline_follow_up_recognizes_explicit_sochi(llm: FakeLLM) -> None:
    query = await llm.contextualize_query("тихий номер", "Сочи")

    parsed = await llm.parse_query(query)

    assert parsed.location_hint == "Сочи"
    assert "сочи" not in parsed.unmatched_terms


async def test_tools_are_planned_only_for_missing_facts(llm: FakeLLM) -> None:
    parsed = await llm.parse_query("вид на закат недалеко от моря")

    calls = await llm.plan_tools(
        parsed,
        ["hotel:h_1", "hotel:h_2"],
        {"hotel:h_1": ["sunset_view", "distance_to_sea"], "hotel:h_2": ["distance_to_sea"]},
    )

    assert [(call.characteristic_key, call.subject) for call in calls] == [
        ("sunset_view", "hotel:h_2")
    ]


async def test_question_uses_the_registry_template(llm: FakeLLM) -> None:
    draft = await llm.formulate_question("pets_policy", "missing", "Приморская")

    assert draft.characteristic_key == "pets_policy"
    assert "Приморская" in draft.text
    assert "{hotel}" not in draft.text


async def test_free_answer_becomes_fields_with_quotes(llm: FakeLLM) -> None:
    extraction = await llm.extract_fields(
        "pets_policy", "С собаками до 10 кг можно, 1500 ₽ в сутки, кошек тоже берём"
    )

    assert {field.name: field.value for field in extraction.fields} == {
        "allowed": True,
        "max_weight_kg": 10.0,
        "fee_rub": 1500.0,
    }
    quotes = {field.name: field.quote for field in extraction.fields}
    assert quotes["max_weight_kg"] == "10 кг"
    assert quotes["fee_rub"] == "1500 ₽"


async def test_refusal_is_extracted_as_false(llm: FakeLLM) -> None:
    extraction = await llm.extract_fields("pets_policy", "К сожалению, с животными нельзя")

    assert [(field.name, field.value) for field in extraction.fields] == [("allowed", False)]
