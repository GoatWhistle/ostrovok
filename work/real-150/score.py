import json
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CASES = {c["id"]: c for c in json.loads((ROOT / "cases-150.json").read_text())}


def normalize(value: object) -> str:
    return str(value or "").casefold().replace("ё", "е")


def surfaces(folder: Path) -> dict[str, dict[str, str]]:
    found: dict[str, dict[str, str]] = {}
    for case in sorted(folder.glob("*.json")):
        if case.name == "summary.json":
            continue
        body = json.loads(case.read_text())
        search = body.get("search") or {}
        parsed = search.get("parsed") or {}
        results = search.get("results") or []
        messages = body.get("messages") or []
        reply = next(
            (m.get("content", "") for m in reversed(messages) if m.get("role") == "assistant"), ""
        )
        asked = [
            *(str(i.get("source_text", "")) for i in (parsed.get("intents") or [])),
            *(str(w) for w in (parsed.get("wishes") or [])),
            *(str(t) for t in (parsed.get("unmatched_terms") or [])),
            *(str(m.get("label", "")) for r in results for m in (r.get("matched") or [])),
            str(body.get("effective_query") or ""),
            str(parsed.get("location_hint") or ""),
        ]
        found[case.stem] = {
            "query": normalize(" | ".join(asked)),
            "reply": normalize(reply),
        }
    return found


def score(path: str) -> dict[str, object]:
    rows = json.loads(Path(path).read_text())
    seen = surfaces(Path(path).parent)
    out: dict[str, object] = {"cases": len(rows)}
    out["http_ok"] = sum(1 for r in rows if r.get("http_status") == 200)
    out["server_errors"] = sum(
        1 for r in rows if isinstance(r.get("http_status"), int) and r["http_status"] >= 500
    )
    out["completed"] = sum(1 for r in rows if not r.get("errors"))
    total = kept_query = kept_any = 0
    lost_cases: list[tuple[str, list[str]]] = []
    for row in rows:
        case = CASES[row["id"]]
        surface = seen.get(row["id"], {"query": "", "reply": ""})
        lost: list[str] = []
        for phrase in case.get("must_keep") or []:
            total += 1
            needle = normalize(phrase)
            in_query = needle in surface["query"]
            kept_query += 1 if in_query else 0
            kept_any += 1 if in_query or needle in surface["reply"] else 0
            if not in_query:
                lost.append(phrase)
        if lost:
            lost_cases.append((row["id"], lost))
    out["conditions"] = total
    out["kept_in_query"] = kept_query
    out["kept_anywhere"] = kept_any
    out["cases_all_kept"] = len(rows) - len(lost_cases)
    out["cases_with_loss"] = len(lost_cases)
    located = [r for r in rows if CASES[r["id"]].get("expected_location")]
    out["located_cases"] = len(located)
    out["location_ok"] = sum(
        1
        for r in located
        if normalize(CASES[r["id"]]["expected_location"]) in normalize(r.get("location_hint"))
    )
    out["honesty_violations"] = sum(len(r.get("unconfirmed_full") or []) for r in rows)
    nonempty = [r for r in rows if r.get("results")]
    out["nonempty"] = len(nonempty)
    out["empty"] = len(rows) - len(nonempty)
    out["distinguishable"] = sum(
        1 for r in nonempty if len({s for s in (r.get("scores") or []) if s is not None}) > 1
    )
    times = [r["seconds"] for r in rows if r.get("seconds")]
    out["latency_median"] = round(statistics.median(times), 1) if times else None
    out["latency_p95"] = (
        round(sorted(times)[max(0, int(len(times) * 0.95) - 1)], 1) if times else None
    )
    by_group: dict[str, dict[str, int]] = {}
    for row in rows:
        case = CASES[row["id"]]
        group = by_group.setdefault(
            str(row["group"]), {"n": 0, "hotels": 0, "conditions": 0, "kept": 0}
        )
        group["n"] += 1
        group["hotels"] += 1 if row.get("results") else 0
        surface = seen.get(row["id"], {"query": "", "reply": ""})
        for phrase in case.get("must_keep") or []:
            group["conditions"] += 1
            group["kept"] += 1 if normalize(phrase) in surface["query"] else 0
    out["by_group"] = by_group
    out["lost"] = lost_cases
    return out


def show(name: str, data: dict[str, object]) -> None:
    print(f"== {name}")
    for key, value in data.items():
        if key not in {"by_group", "lost"}:
            print(f"   {key}: {value}")


if __name__ == "__main__":
    first = score(sys.argv[1])
    show(sys.argv[1], first)
    if len(sys.argv) > 2:
        second = score(sys.argv[2])
        show(sys.argv[2], second)
        print("== delta (second minus first)")
        for key, value in first.items():
            if key in {"by_group", "lost"} or value is None or second.get(key) is None:
                continue
            if isinstance(value, int | float) and isinstance(second[key], int | float):
                print(f"   {key}: {value} -> {second[key]} ({second[key] - value:+g})")
    print(json.dumps(first["by_group"], ensure_ascii=False, indent=1))
    print("== cases that lost a condition")
    for case_id, lost in first["lost"]:
        print(f"   {case_id}: {', '.join(lost)}")
