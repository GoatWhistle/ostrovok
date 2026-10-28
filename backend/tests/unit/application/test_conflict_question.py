from hotel_agent.application.agent.data_evidence import conflict_question


def test_conflict_question_follows_russian_query_language() -> None:
    question = conflict_question("тихий отель у моря", ["тихий", "у моря"])

    assert (
        question
        == "Ни один проверенный отель не подходит одновременно под «тихий», «у моря». Что можно ослабить?"
    )


def test_conflict_question_is_english_for_latin_query() -> None:
    question = conflict_question("quiet hotel by the sea", ["quiet", "by the sea"])

    assert question.startswith("No verified hotel matches")
    assert question.endswith("Which condition can I relax?")
