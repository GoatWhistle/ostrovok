import json
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PLAN = ROOT / "search-22.md"
OUTPUT = ROOT / "search-22-results.json"
URL = "http://127.0.0.1:8080/api/v1/search"


def main() -> None:
    queries = []
    for line in PLAN.read_text().splitlines():
        match = re.match(r"\| (\d+) \| (.*?) \|", line)
        if match:
            queries.append((int(match.group(1)), match.group(2)))
    results = []
    for number, query in queries:
        started = time.monotonic()
        request = urllib.request.Request(
            URL,
            data=json.dumps({"query": query, "region_id": "sochi", "limit": 20}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        record = {"number": number, "query": query}
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                body = json.load(response)
            record.update(
                {
                    "status": response.status,
                    "parsed": body.get("parsed"),
                    "result_count": len(body.get("results", [])),
                    "first_results": [
                        {
                            "hotel": item["hotel"]["name"],
                            "matched": item.get("matched"),
                        }
                        for item in body.get("results", [])[:3]
                    ],
                    "took_ms": body.get("took_ms"),
                }
            )
        except (urllib.error.URLError, TimeoutError, ValueError) as error:
            record["error"] = str(error)
        record["elapsed_s"] = round(time.monotonic() - started, 2)
        results.append(record)
        OUTPUT.write_text(
            json.dumps(
                {"ran_at": datetime.now(timezone.utc).isoformat(), "results": results},
                ensure_ascii=False,
                indent=2,
            )
            + "\n"
        )
        print(
            f"{number:02d} {record.get('status', 'ERR')} "
            f"{record.get('result_count', '-')} {record['elapsed_s']}s",
            flush=True,
        )


if __name__ == "__main__":
    main()
