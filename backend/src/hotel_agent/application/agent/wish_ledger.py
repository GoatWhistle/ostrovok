import json
from collections import Counter
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any

SOURCES = {
    "search_events": "web",
    "read_event_page": "web",
    "observe_wildlife": "geography",
    "find_photos": "web",
    "measure_landcover": "geography",
    "check_requested": "database",
    "read_records": "database",
    "inspect_data": "database",
    "search_documents": "embeddings",
    "get_provider_content": "provider",
    "get_room_offers": "provider",
    "search_web": "web",
    "read_web_page": "web",
    "measure_terrain": "geography",
    "measure_geometry": "geography",
    "find_hotels": "geography",
    "find_nearby": "geography",
    "assess_view": "geography",
    "get_weather": "environment",
    "calculate_sun": "environment",
}


BUDGET = {"search_web": 8, "find_hotels": 3, "search_documents": 8, "read_web_page": 10}


@dataclass
class WishLedger:
    available: Mapping[str, bool]
    checked: set[str] = field(default_factory=set)
    unavailable: set[str] = field(default_factory=set)
    pending_pages: dict[str, int] = field(default_factory=dict)
    calls: dict[str, dict[str, Any]] = field(default_factory=dict)
    duplicates: int = 0
    finishes: Counter[str] = field(default_factory=Counter)
    used: Counter[str] = field(default_factory=Counter)

    def exhausted(self, action: str) -> bool:
        return self.used[action] >= BUDGET.get(action, 0) > 0

    def repeated_finish(self, signature: str) -> bool:
        self.finishes[signature] += 1
        return self.finishes[signature] >= 3

    def identity(self, action: str, arguments: dict[str, Any]) -> str:
        return json.dumps([action, arguments], sort_keys=True, ensure_ascii=False)

    def observe(self, action: str, arguments: dict[str, Any], result: dict[str, Any]) -> None:
        self.calls[self.identity(action, arguments)] = result
        self.used[action] += 1
        dataset = str(arguments.get("dataset", ""))
        source = (
            "embeddings"
            if dataset == "retrieved_documents"
            else "provider"
            if dataset.startswith("provider_")
            else "web"
            if dataset == "web_documents"
            else SOURCES.get(action, "database")
        )
        self.checked.update(
            name for name in result.get("checked_sources", ()) if name in self.available
        )
        if result.get("unavailable") or ("unavailable" in str(result.get("error", "")).lower()):
            self.checked.add(source)
            self.unavailable.add(source)
        elif (
            not result.get("error")
            and not result.get("needs_input")
            and action not in {"inspect_data", "list_candidates"}
            and (action != "check_requested" or result.get("record_count", 0) > 0)
        ):
            self.checked.add(source)
        if action == "match_records" and not result.get("error"):
            if result.get("has_more"):
                self.pending_pages[dataset] = int(result["next_offset"])
            else:
                self.pending_pages.pop(dataset, None)

    def missing(self, irrelevant: tuple[str, ...]) -> tuple[str, ...]:
        required = {name for name, enabled in self.available.items() if enabled}
        return tuple(sorted(required - self.checked - set(irrelevant)))
