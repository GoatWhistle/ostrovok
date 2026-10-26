from hotel_agent.adapters.llm.query_payload import parse_payload


def test_model_location_fragment_is_not_researched_as_a_hotel_property() -> None:
    query = "отель в Санкт-Петербурге в центре с видом на собор"
    parsed = parse_payload(
        {
            "location_hint": "Санкт-Петербург",
            "location_source_text": "отель в Санкт-Петербурге",
            "wishes": ["отель в Санкт-Петербурге", "в центре", "с видом на собор"],
            "unmatched_terms": ["отель в Санкт-Петербурге", "в центре"],
        },
        query,
        lambda raw, query: None,
    )
    assert parsed.wishes == ("в центре", "с видом на собор")
    assert parsed.unmatched_terms == ("в центре",)


def test_location_fragment_without_resolved_location_does_not_drop_a_wish() -> None:
    parsed = parse_payload(
        {"location_source_text": "на море", "wishes": ["на море"]},
        "хочу на море",
        lambda raw, query: None,
    )
    assert parsed.wishes == ("на море",)
