import re
from collections.abc import Mapping
from typing import Any
from urllib.parse import quote

ARTICLE = re.compile(r"^([a-z]{2,8}):(.+)$")
ITEM = re.compile(r"^Q\d+$")
SITE_KEYS = ("website", "contact:website")


def reference_urls(tags: Mapping[str, Any]) -> list[str]:
    urls: list[str] = []
    article = ARTICLE.match(str(tags.get("wikipedia") or "").strip())
    if article:
        title = article.group(2).strip().replace(" ", "_")
        if title:
            urls.append(
                f"https://{article.group(1)}.wikipedia.org/wiki/{quote(title, safe='_(),!')}"
            )
    item = str(tags.get("wikidata") or "").strip()
    if ITEM.match(item):
        urls.append(f"https://www.wikidata.org/wiki/{item}")
    for key in SITE_KEYS:
        value = str(tags.get(key) or "").strip()
        if value.startswith("http"):
            urls.append(value)
    return list(dict.fromkeys(urls))


NAME_KEYS = {"name", "old_name", "alt_name", "official_name", "short_name"}
LANGUAGE = re.compile(r"^[a-z]{2,8}:(.+)$")


def catalogue_names(tags: Mapping[str, Any]) -> list[str]:
    names: list[str] = []
    for key, value in tags.items():
        text = str(value).strip()
        if not text:
            continue
        if key.split(":")[0] in NAME_KEYS:
            names.append(text)
        elif key == "wikipedia":
            article = LANGUAGE.match(text)
            if article:
                names.append(article.group(1).strip())
    return list(dict.fromkeys(names))
