from hotel_agent.adapters.llm.attempt_budget import AttemptBudget


def test_an_unmeasured_model_keeps_the_initial_budget() -> None:
    budget = AttemptBudget(ceiling_s=30)

    assert budget.timeout("main", initial=8) == 8
    assert budget.timeout("main", initial=40) == 30


def test_a_stalled_attempt_raises_the_next_budget_up_to_the_ceiling() -> None:
    budget = AttemptBudget(ceiling_s=30)

    budget.stalled("main", 8)
    assert budget.timeout("main", initial=8) == 12

    budget.stalled("main", 12)
    assert budget.timeout("main", initial=8) == 18

    budget.stalled("main", 25)
    assert budget.timeout("main", initial=8) == 30


def test_a_measured_answer_lowers_the_budget_but_never_below_the_initial() -> None:
    budget = AttemptBudget(ceiling_s=30)

    budget.stalled("main", 20)
    budget.answered("main", 2)
    assert budget.timeout("main", initial=8) == 16.5

    budget.answered("main", 1)
    budget.answered("main", 1)
    assert budget.timeout("main", initial=8) == 8


def test_the_spare_model_goes_first_while_the_first_one_keeps_stalling() -> None:
    budget = AttemptBudget(ceiling_s=30)
    models = ("main", "spare")

    for _ in range(2):
        budget.stalled("main", 8)
    assert budget.order(models) == models

    budget.stalled("main", 8)
    assert budget.order(models) == ("spare", "main")

    budget.answered("main", 9)
    assert budget.order(models) == models


def test_a_stalling_spare_does_not_displace_the_first_model() -> None:
    budget = AttemptBudget(ceiling_s=30)
    for _ in range(3):
        budget.stalled("main", 8)
        budget.stalled("spare", 8)

    assert budget.order(("main", "spare")) == ("main", "spare")
    assert budget.order(("main", "main")) == ("main", "main")
