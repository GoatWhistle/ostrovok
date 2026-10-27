from hotel_agent.application.quality_metrics import (
    CharacteristicMetric,
    overall_coverage,
    overall_hotelier_share,
)


def metric(key: str, covered: int, from_hotelier: int = 0) -> CharacteristicMetric:
    return CharacteristicMetric(
        characteristic_key=key,
        hotels=100,
        covered=covered,
        open_questions=100 - covered,
        from_hotelier=from_hotelier,
    )


def test_coverage_counts_hotels_with_a_known_value() -> None:
    assert metric("noise_level", 75).coverage == 0.75
    assert metric("rooms", 0).coverage == 0.0


def test_hotelier_share_is_measured_against_what_is_known() -> None:
    assert metric("pets_policy", 40, from_hotelier=10).hotelier_share == 0.25
    assert metric("pets_policy", 0, from_hotelier=0).hotelier_share == 0.0


def test_overall_coverage_averages_the_characteristics() -> None:
    assert overall_coverage([metric("a", 100), metric("b", 0)]) == 0.5
    assert overall_coverage([]) == 0.0


def test_overall_hotelier_share_counts_values_not_characteristics() -> None:
    rows = [metric("a", 90, from_hotelier=0), metric("b", 10, from_hotelier=10)]

    assert overall_hotelier_share(rows) == 0.1
    assert overall_hotelier_share([]) == 0.0


def test_a_region_without_hotels_reports_zero_instead_of_failing() -> None:
    empty = CharacteristicMetric(
        characteristic_key="noise_level", hotels=0, covered=0, open_questions=0, from_hotelier=0
    )

    assert empty.coverage == 0.0
    assert empty.hotelier_share == 0.0
