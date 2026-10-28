EXONYMS = {
    "москва": "Moscow",
    "санкт-петербург": "Saint Petersburg",
    "россия": "Russia",
    "байкал": "Lake Baikal",
    "красная поляна": "Krasnaya Polyana",
    "нижний новгород": "Nizhny Novgorod",
    "ростов-на-дону": "Rostov-on-Don",
}

LETTERS = {
    "а": "a",
    "б": "b",
    "в": "v",
    "г": "g",
    "д": "d",
    "е": "e",
    "ё": "yo",
    "ж": "zh",
    "з": "z",
    "и": "i",
    "й": "y",
    "к": "k",
    "л": "l",
    "м": "m",
    "н": "n",
    "о": "o",
    "п": "p",
    "р": "r",
    "с": "s",
    "т": "t",
    "у": "u",
    "ф": "f",
    "х": "kh",
    "ц": "ts",
    "ч": "ch",
    "ш": "sh",
    "щ": "shch",
    "ъ": "",
    "ы": "y",
    "ь": "",
    "э": "e",
    "ю": "yu",
    "я": "ya",
}


def transliterate(text: str) -> str:
    out: list[str] = []
    for char in text:
        lower = char.lower()
        latin = LETTERS.get(lower)
        if latin is None:
            out.append(char)
        elif char != lower and latin:
            out.append(latin[0].upper() + latin[1:])
        else:
            out.append(latin)
    return "".join(out)


def english_place(name: str) -> str:
    known = EXONYMS.get(" ".join(name.split()).casefold())
    return known or transliterate(name)


def localized_place(name: str, locale: str) -> str:
    return english_place(name) if locale == "en" else name
