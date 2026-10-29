import re

TOPICS: dict[str, re.Pattern[str]] = {
    "pets_policy": re.compile(
        r"собак|собач|пёс|пес\b|псом|кошк|кот\b|котом|животн|питом|\bpets?\b|\bdogs?\b|\bcats?\b",
        re.IGNORECASE,
    ),
    "blackout_curtains": re.compile(r"штор|блэкаут|блекаут|blackout|curtain", re.IGNORECASE),
    "double_room": re.compile(r"двухместн|\bdouble\b", re.IGNORECASE),
    "room_capacity": re.compile(
        r"вместим|сколько (?:человек|гостей|взрослых)|how many (?:guests|people|adults)|capacity",
        re.IGNORECASE,
    ),
}

SEARCH = re.compile(
    r"найд|найти|подбер|поищ|ищу|другой отель|другие отели|покажи отел|\bfind\b|\bsearch\b"
    r"|another hotel|other hotels",
    re.IGNORECASE,
)


def owner_topics(text: str) -> tuple[str, ...]:
    if SEARCH.search(text):
        return ()
    return tuple(key for key, pattern in TOPICS.items() if pattern.search(text))
