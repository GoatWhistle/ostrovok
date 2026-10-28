ANYWHERE_PHRASES = (
    "город не важен",
    "город неважен",
    "по всей россии",
    "где угодно",
    "любой город",
    "неважно где",
    "не важно где",
    "the city does not matter",
    "search across russia",
    "any city",
    "anywhere in russia",
)
ANYWHERE_MARK = "город не важен"


def says_anywhere(query: str) -> bool:
    text = query.casefold().replace("ё", "е")
    return any(phrase in text for phrase in ANYWHERE_PHRASES)


def keep_anywhere(message: str, query: str) -> str:
    if not says_anywhere(message) or says_anywhere(query):
        return query
    return f"{query}, {ANYWHERE_MARK}"
