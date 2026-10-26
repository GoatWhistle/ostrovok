from html.parser import HTMLParser


class PageText(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self.title: list[str] = []
        self.links: list[tuple[str, str]] = []
        self._link: str | None = None
        self._link_text: list[str] = []
        self._hidden = 0
        self._title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style", "noscript", "svg"}:
            self._hidden += 1
        if tag == "title":
            self._title = True
        if tag == "a":
            self._link = dict(attrs).get("href")
            self._link_text = []

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript", "svg"}:
            self._hidden = max(0, self._hidden - 1)
        if tag == "title":
            self._title = False
        if tag == "a" and self._link:
            self.links.append((self._link, " ".join(self._link_text)))
            self._link = None

    def handle_data(self, data: str) -> None:
        if not self._hidden and data.strip():
            self.parts.append(" ".join(data.split()))
            if self._title:
                self.title.append(data.strip())
            if self._link:
                self._link_text.append(data.strip())
