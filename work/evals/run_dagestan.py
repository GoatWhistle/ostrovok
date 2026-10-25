import argparse
import json
import runpy
import time
from pathlib import Path

from hotel_agent.adapters.geo.search_areas import SearchAreas

ROOT = Path(__file__).resolve().parent


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("case", choices=["fresh", "context"])
    parser.add_argument("--saved", action="store_true")
    args = parser.parse_args()
    output = ROOT / f"dagestan-{args.case}.json"
    if output.exists() and not args.saved:
        raise FileExistsError(output)
    api = runpy.run_path(str(ROOT / "run_diverse_50.py"))
    assert api["request"]("/api/v1/health")[0] == 200
    payload = {"region_id": "russia", "locale": "ru"}
    if args.case == "fresh":
        payload["message"] = "хочу отель высоко в горах в дагестане"
    else:
        payload["message"] = "просто в принципе в любом в горах главное и в Дагестане"
        payload["conversation_id"] = "29180a98-3251-4367-ae43-107698605da3"
    if args.saved:
        record = json.loads(output.read_text())
        status, body = record["status"], record["response"]
    else:
        started = time.monotonic()
        status, body = api["request"]("/api/v1/chat/messages", payload)
        record = {"request": payload, "status": status,
                  "elapsed_s": round(time.monotonic() - started, 2), "response": body}
        output.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n")
    print("HTTP", status, "seconds", record["elapsed_s"], flush=True)
    assert status == 200
    summary = api["summarize"](body)
    print(summary["answer"], flush=True)
    print(summary["parsed"], flush=True)
    for item in summary["top_results"][:3]:
        print(item["hotel"]["name"], item["matched"], flush=True)
    assert summary["parsed"]["location_hint"] in {"Дагестан", "Республика Дагестан"}
    assert not summary["parsed"]["needs_clarification"]
    assert summary["result_count"] > 0
    assert any(m["characteristic_key"].startswith("derived:") and m["match"] == "partial"
               for m in summary["top_results"][0]["matched"])
    area = SearchAreas(ROOT.parents[1] / "data/seed/russia-admin1.geojson").resolve("Дагестан")
    assert area is not None
    for result in body["search"]["results"]:
        position = result["hotel"]["location"]
        assert area.contains(tuple(position)), result["hotel"]["name"]
    print("PASS: region, terrain evidence and returned hotel boundaries", flush=True)


if __name__ == "__main__":
    main()
