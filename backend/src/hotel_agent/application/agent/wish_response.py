from collections.abc import Sequence

from hotel_agent.application.agent.wish_records import WishResult, WishStatus

MESSAGES = {
    "ru": {
        WishStatus.INCOMPLETE: "Проверка не завершена",
        WishStatus.UNAVAILABLE: "Не удалось проверить из-за недоступности источника",
        WishStatus.EXHAUSTED: "В проверенных источниках подтверждение не найдено",
    },
    "en": {
        WishStatus.INCOMPLETE: "Verification is incomplete",
        WishStatus.UNAVAILABLE: "Could not verify because a source was unavailable",
        WishStatus.EXHAUSTED: "No confirmation in the checked sources",
    },
}


def wish_response(answer: str, results: Sequence[WishResult], locale: str) -> str:
    messages = MESSAGES.get(locale, MESSAGES["ru"])
    for status, message in messages.items():
        terms = "; ".join(row.term for row in results if row.status is status)
        if terms:
            answer += f" {message}: {terms}."
    return answer
