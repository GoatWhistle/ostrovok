import json
from dataclasses import dataclass, field
from html.parser import HTMLParser
from typing import Any

from hotel_agent.adapters.external.hotel_metadata import FIELDS, TYPES

VOID = frozenset(
    ("area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "wbr")
)
MAX_RECORDS = 10
MAX_PROPERTIES = 60
MAX_TEXT = 300
MAX_DEPTH = 12


@dataclass(slots=True)
class _Scope:
    kind: str | None
    prop: str | None
    depth: int
    record: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class _Text:
    prop: str
    depth: int
    parts: list[str] = field(default_factory=list)


class MicrodataHotels(HTMLParser):
    def __init__(self, types: frozenset[str] = TYPES, fields: frozenset[str] = FIELDS) -> None:
        super().__init__()
        self._types, self._fields = types, fields
        self.records: list[dict[str, Any]] = []
        self._scopes: list[_Scope] = []
        self._text: _Text | None = None
        self._depth = 0

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        prop = (attributes.get("itemprop") or "").strip() or None
        if "itemscope" in attributes:
            if len(self._scopes) < MAX_DEPTH:
                kind = (attributes.get("itemtype") or "").rstrip("/").rsplit("/", 1)[-1] or None
                self._scopes.append(_Scope(kind=kind, prop=prop, depth=self._depth))
        elif prop is not None and self._scopes:
            value = attributes.get("content") or attributes.get("href") or attributes.get("src")
            if value is not None:
                self._add(prop, " ".join(value.split())[:MAX_TEXT])
            elif tag not in VOID and self._text is None:
                self._text = _Text(prop=prop, depth=self._depth)
        if tag not in VOID:
            self._depth += 1

    def handle_data(self, data: str) -> None:
        if self._text is not None and len(self._text.parts) < 64:
            self._text.parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in VOID or self._depth == 0:
            return
        self._depth -= 1
        if self._text is not None and self._text.depth >= self._depth:
            text = " ".join("".join(self._text.parts).split())[:MAX_TEXT]
            if text:
                self._add(self._text.prop, text)
            self._text = None
        while self._scopes and self._scopes[-1].depth >= self._depth:
            self._close(self._scopes.pop())

    def results(self) -> tuple[dict[str, Any], ...]:
        while self._scopes:
            self._close(self._scopes.pop())
        return tuple(self.records)

    def evidence(self) -> str:
        if not self.records:
            return ""
        text = json.dumps(self.records, ensure_ascii=False, indent=2)
        if len(text) > 16_000:
            return ""
        return "\nРазметка microdata со страницы (непроверенная):\n" + text

    def _close(self, scope: _Scope) -> None:
        record = scope.record
        if scope.kind is not None:
            record = {"@type": scope.kind, **record}
        if scope.kind in self._types:
            if len(self.records) < MAX_RECORDS and record:
                self.records.append(
                    {key: value for key, value in record.items() if key in self._fields}
                )
            return
        if self._scopes and scope.prop is not None and record:
            self._attach(self._scopes[-1], scope.prop, record)

    def _add(self, prop: str, value: str) -> None:
        if self._scopes:
            self._attach(self._scopes[-1], prop, value)

    def _attach(self, scope: _Scope, prop: str, value: object) -> None:
        if len(scope.record) >= MAX_PROPERTIES and prop not in scope.record:
            return
        present = scope.record.get(prop)
        if present is None:
            scope.record[prop] = value
        elif isinstance(present, list):
            if len(present) < 32:
                present.append(value)
        else:
            scope.record[prop] = [present, value]
