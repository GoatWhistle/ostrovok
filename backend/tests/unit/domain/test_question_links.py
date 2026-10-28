from hotel_agent.domain.question_links import question_token, token_matches
from hotel_agent.domain.value_objects import QuestionId

QUESTION = QuestionId("q_h1_pets_policy")
OTHER = QuestionId("q_h2_pets_policy")
SECRET = "a-long-enough-secret"


def test_the_same_question_always_gets_the_same_token() -> None:
    assert question_token(QUESTION, SECRET) == question_token(QUESTION, SECRET)
    assert len(question_token(QUESTION, SECRET)) == 16


def test_another_question_or_secret_gets_another_token() -> None:
    assert question_token(QUESTION, SECRET) != question_token(OTHER, SECRET)
    assert question_token(QUESTION, SECRET) != question_token(QUESTION, "other-secret")


def test_a_token_opens_only_its_own_question() -> None:
    token = question_token(QUESTION, SECRET)

    assert token_matches(QUESTION, token, SECRET)
    assert token_matches(QUESTION, f"  {token.upper()}  ", SECRET)
    assert not token_matches(OTHER, token, SECRET)
    assert not token_matches(QUESTION, token, "other-secret")


def test_nothing_matches_without_a_token_or_a_secret() -> None:
    token = question_token(QUESTION, SECRET)

    assert not token_matches(QUESTION, "", SECRET)
    assert not token_matches(QUESTION, token, "")


def test_a_non_ascii_token_is_rejected_instead_of_raising() -> None:
    assert not token_matches(QUESTION, "пароль1234567890", SECRET)
    assert not token_matches(QUESTION, "🔑🔑🔑🔑🔑🔑🔑🔑", SECRET)
