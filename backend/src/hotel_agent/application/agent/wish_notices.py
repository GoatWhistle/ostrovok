from typing import Any

PRESSED = (
    "Most of the time for this wish is used. Stop widening the search: either confirm the wish"
    " with the data you already have or finish honestly with what is established."
)
LAST_CALL = (
    "The time for this wish is almost over. Finish now: name what the sources did and did not"
    " establish. An unfinished check is not evidence that no hotel matches."
)
NOTICES = ((60, PRESSED), (85, LAST_CALL))
STALLED = (
    "The last calls established nothing about this wish. Stop trying new sources: either state a"
    " criterion over fields you already have, or finish honestly with what is established."
)
CRITERIA_FAILED = "Checks do not establish this wish; use returned fields and their actual scope."
SOURCES_LEFT = (
    "No match yet. Check remaining relevant sources or explain why they cannot establish this"
    " wish. Unread pages cannot count as exhausted."
)


def time_notice(spent: float, left: float, warned: set[int]) -> dict[str, Any] | None:
    for share, message in NOTICES:
        if spent * 100 >= share and share not in warned:
            warned.add(share)
            return {
                "tool": "time_budget",
                "result": {"error": message, "remaining_seconds": round(left, 1)},
            }
    return None


def stall_notice(barren: int) -> dict[str, Any]:
    return {
        "tool": "progress_check",
        "result": {"error": STALLED, "steps_without_evidence": barren},
    }


def criteria_notice(fields: dict[str, str]) -> dict[str, Any]:
    return {"tool": "validate_criteria", "result": {"error": CRITERIA_FAILED, "fields": fields}}


def budget_notice(action: str, used: int) -> dict[str, Any]:
    return {
        "tool": action,
        "result": {
            "error": f"Budget for {action} in this wish is used up."
            " Use a different source or finish with what is established.",
            "used": used,
        },
    }


def duplicate_notice(action: str, previous: dict[str, Any]) -> dict[str, Any]:
    return {
        "tool": action,
        "result": {
            "error": "Identical call already returned these data."
            " Choose a new query/source or justify completion.",
            "previous": previous,
        },
    }
