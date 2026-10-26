import json

import pytest

from hotel_agent.adapters.llm.offline_review import review_typed_recommendations


@pytest.mark.parametrize(
    ("facts", "accepted"),
    (
        ([], True),
        ([{"quality": "unknown", "fact": None}], False),
        (
            [
                {
                    "quality": "full",
                    "fact": {
                        "value": True,
                        "qualifiers": {
                            "native_characteristic_key": "room_capacity",
                            "native_value": 2,
                        },
                    },
                }
            ],
            True,
        ),
        ([{"quality": "full", "fact": {"value": True, "qualifiers": {}}}], False),
    ),
)
def test_offline_review_only_accepts_typed_confirmations_or_location_only_queries(
    facts: list[dict[str, object]],
    accepted: bool,
) -> None:
    context = json.dumps(
        {
            "mode": "recommendation_scope",
            "records": [
                {"record_id": "hotel", "source_text": json.dumps({"facts": facts})},
            ],
        }
    )
    verdicts = review_typed_recommendations(context)
    assert verdicts[0].supported is accepted
