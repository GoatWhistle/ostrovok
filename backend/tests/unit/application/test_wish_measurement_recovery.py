from hotel_agent.application.agent.data_records import DataStep
from hotel_agent.domain.errors import ModelFailure
from tests.unit.application.test_data_explorer import QUERY, build, criterion, hotel


async def test_valid_grounded_plan_survives_a_later_provider_failure() -> None:
    explorer, _, _ = build(
        [
            DataStep(
                action="measure_terrain", arguments={"radius_m": 1000, "search_radius_m": 30000}
            ),
            DataStep(action="inspect_data", arguments={}, criteria=(criterion(),)),
            ModelFailure("provider unavailable"),
        ],
        readings={"mountain": {"elevation_m": 1600, "relief_m": 600}},
    )

    outcome = await explorer(
        QUERY, ("высоко в горах",), "Владикавказ", "russia", [hotel("city")], None, True
    )

    assert outcome.resolved_terms == ("высоко в горах",)
    assert next(row for row in outcome.facts if row.hotel_id == "mountain").value is True
    assert next(row for row in outcome.facts if row.hotel_id == "city").value is None


async def test_proposed_checks_are_grounded_after_the_measurement_before_next_model_call() -> None:
    explorer, _, _ = build(
        [
            DataStep(
                action="measure_terrain", arguments={"radius_m": 1000}, criteria=(criterion(),)
            ),
            ModelFailure("provider unavailable"),
        ],
        readings={"city": {"elevation_m": 1600, "relief_m": 600}},
    )

    outcome = await explorer(
        QUERY, ("высоко в горах",), "Владикавказ", "russia", [hotel("city")], None, True
    )

    assert outcome.facts[0].value is True
    assert "1600" in outcome.facts[0].explanation
    assert "900" in outcome.facts[0].explanation
