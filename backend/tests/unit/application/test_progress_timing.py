from hotel_agent.application import progress


class Recorder:
    def __init__(self) -> None:
        self.rows: list[tuple[str, dict[str, object]]] = []

    def info(self, event: str, **fields: object) -> None:
        self.rows.append((event, fields))

    def warning(self, event: str, **fields: object) -> None:
        self.rows.append((event, fields))

    def error(self, event: str, *, exc: BaseException | None = None, **fields: object) -> None:
        self.rows.append((event, fields))


def test_each_stage_logs_its_duration_when_the_next_one_starts() -> None:
    recorder = Recorder()
    progress.time_stages(recorder)

    progress.mark("rewrite")
    progress.step("parsing")
    progress.step("parsed")
    progress.mark("done")

    stages = [(fields["stage"], fields["next"]) for _, fields in recorder.rows]
    assert stages == [("rewrite", "parsing"), ("parsing", "parsed"), ("parsed", "done")]
    assert all(event == "chat_stage" for event, _ in recorder.rows)
    assert all(isinstance(fields["seconds"], float) for _, fields in recorder.rows)
