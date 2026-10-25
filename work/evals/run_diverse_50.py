import json
import subprocess
import threading
import time
import urllib.error
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
BASE = "http://127.0.0.1:8080"
OUTPUT = ROOT / "diverse-50-results.json"
LOCK = threading.Lock()
RESULTS: list[dict[str, Any]] = []
METADATA: dict[str, Any] = {}


def request(path: str, payload: dict[str, Any] | None = None) -> tuple[int, Any]:
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        BASE + path,
        data=data,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=130) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, {"error_body": error.read().decode(errors="replace")[:2000]}


def inspect_links(search: dict[str, Any]) -> dict[str, Any]:
    hotels = search.get("results", [])
    if not hotels:
        return {}
    refs = list(
        dict.fromkeys(
            ref
            for hotel in hotels[:3]
            for match in hotel.get("matched", [])
            for ref in match.get("geo_refs", [])
        )
    )[:10]
    checks: dict[str, Any] = {}
    try:
        status, card = request(f"/api/v1/hotels/{hotels[0]['hotel']['id']}")
        checks["card"] = {
            "status": status,
            "hotel_id": hotels[0]["hotel"]["id"],
            "room_count": len(card.get("rooms", [])),
            "rooms": card.get("rooms", [])[:3],
        }
    except Exception as error:
        checks["card"] = {"error": f"{type(error).__name__}: {error}"}
    if refs:
        try:
            status, body = request("/api/v1/geo-features:batch", {"ids": refs})
            found = {str(item["id"]) for item in body.get("features", [])}
            checks["geo"] = {
                "status": status,
                "requested": refs,
                "found": sorted(found),
                "missing": [ref for ref in refs if ref not in found],
            }
        except Exception as error:
            checks["geo"] = {"error": f"{type(error).__name__}: {error}"}
    return checks


def summarize(body: dict[str, Any]) -> dict[str, Any]:
    search = body.get("search") or {}
    hotels = search.get("results", [])
    return {
        "conversation_id": body.get("id"),
        "effective_query": body.get("effective_query"),
        "answer": next(
            (
                item["content"]
                for item in reversed(body.get("messages", []))
                if item["role"] == "assistant"
            ),
            None,
        ),
        "parsed": search.get("parsed"),
        "result_count": len(hotels),
        "ranking": [
            {
                "id": item["hotel"]["id"],
                "name": item["hotel"]["name"],
                "score": item["score"],
                "qualities": [match["match"] for match in item.get("matched", [])],
            }
            for item in hotels
        ],
        "top_results": [
            {
                "hotel": item["hotel"],
                "score": item["score"],
                "matched": item.get("matched", []),
            }
            for item in hotels[:3]
        ],
        "checks": inspect_links(search),
    }


def save(record: dict[str, Any]) -> None:
    with LOCK:
        RESULTS.append(record)
        data = dict(METADATA, results=sorted(RESULTS, key=lambda item: item["id"]))
        temporary = OUTPUT.with_suffix(".tmp")
        temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
        temporary.replace(OUTPUT)
        body = record.get("response", {})
        parsed = body.get("parsed") or {}
        print(
            f"{len(RESULTS):02d}/50 case={record['id']:02d} "
            f"HTTP={record.get('status', 'ERR')} city={parsed.get('location_hint')} "
            f"hotels={body.get('result_count', '-')} "
            f"clarify={parsed.get('needs_clarification')} "
            f"{record['elapsed_s']}s",
            flush=True,
        )


def run_group(cases: list[dict[str, Any]]) -> None:
    conversation = None
    for case in cases:
        started = time.monotonic()
        record = {
            "id": case["id"],
            "group": case["group"],
            "query": case["query"],
            "sent_conversation_id": conversation,
            "sent_at": datetime.now(UTC).isoformat(),
        }
        try:
            status, body = request(
                "/api/v1/chat/messages",
                {
                    "conversation_id": conversation,
                    "message": case["query"],
                    "region_id": "russia",
                    "locale": "ru",
                },
            )
            record["status"] = status
            record["elapsed_s"] = round(time.monotonic() - started, 2)
            if status == 200:
                conversation = body["id"]
                record["response"] = summarize(body)
            else:
                record["error"] = body
        except Exception as error:
            record["error"] = f"{type(error).__name__}: {error}"
        record.setdefault("elapsed_s", round(time.monotonic() - started, 2))
        save(record)


def command(*args: str) -> str:
    return subprocess.check_output(args, text=True).strip()


def main() -> None:
    cases = json.loads((ROOT / "diverse-50-cases.json").read_text())
    if len(cases) != 50 or {item["id"] for item in cases} != set(range(1, 51)):
        raise ValueError("Expected exactly 50 unique fixed cases")
    if OUTPUT.exists():
        raise FileExistsError(
            "Preserve the previous run before starting another paid run"
        )
    METADATA.update(
        {
            "started_at": datetime.now(UTC).isoformat(),
            "base_url": BASE,
            "endpoint": "/api/v1/chat/messages",
            "workers": 2,
            "sha": command("git", "rev-parse", "HEAD"),
            "backend_image": command(
                "docker", "inspect", "--format", "{{.Image}}", "hotel-agent-backend-1"
            ),
            "model_config": command(
                "docker",
                "exec",
                "hotel-agent-backend-1",
                "printenv",
                "LLM_MODEL",
                "LLM_FALLBACK_MODEL",
            ),
            "health_before": request("/api/v1/health"),
        }
    )
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for case in cases:
        groups[case["group"]].append(case)
    with ThreadPoolExecutor(max_workers=2) as executor:
        list(executor.map(run_group, groups.values()))
    METADATA["finished_at"] = datetime.now(UTC).isoformat()
    METADATA["health_after"] = request("/api/v1/health")
    METADATA["sha_after"] = command("git", "rev-parse", "HEAD")
    with LOCK:
        OUTPUT.write_text(
            json.dumps(
                dict(METADATA, results=sorted(RESULTS, key=lambda x: x["id"])),
                ensure_ascii=False,
                indent=2,
            )
            + "\n"
        )
    if len(RESULTS) != 50:
        raise RuntimeError(f"Only {len(RESULTS)} cases completed")


if __name__ == "__main__":
    main()
