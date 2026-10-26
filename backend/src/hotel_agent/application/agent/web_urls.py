import re
from urllib.parse import quote, unquote, urlsplit, urlunsplit

SAFE = "/:@!$&'()*+,;=~"
BROKEN_ESCAPE = re.compile("%(?![0-9A-Fa-f]{2})")


def malformed_url(url: str) -> bool:
    return bool(BROKEN_ESCAPE.search(url))


def canonical_url(url: str) -> str:
    parts = urlsplit(url.strip())
    host = (parts.hostname or "").removeprefix("www.")
    port = f":{parts.port}" if parts.port and parts.port not in {80, 443} else ""
    path = quote(unquote(parts.path), safe=SAFE) or "/"
    query = quote(unquote(parts.query), safe=SAFE + "?&=")
    return urlunsplit((parts.scheme.lower(), host + port, path.rstrip("/") or "/", query, ""))
