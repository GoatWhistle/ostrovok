import json
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PLAN = ROOT / "adversarial-10.md"
URL = "http://127.0.0.1:8000/api/v1/search"


def main() -> None:
    queries = []
    for line in PLAN.read_text().splitlines():
        match = re.match(r"\| (\d+) \| (.*?) \|", line)
        if match:
            queries.append((int(match.group(1)), match.group(2)))
    if len(queries) != 10:
        raise ValueError(f"Expected 10 fixed queries, got {len(queries)}")
    selected = {int(item) for item in sys.argv[1:]}
    output = ROOT / (
        "adversarial-10-retest.json" if selected else "adversarial-10-results.json"
    )
    results = []
    for number, query in queries:
        if selected and number not in selected:
            continue
        started = time.monotonic()
        request = urllib.request.Request(
            URL,
            data=json.dumps({"query": query, "region_id": "russia", "limit": 10}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        record = {"number": number, "query": query}
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                record["status"] = response.status
                record["response"] = json.load(response)
        except (urllib.error.URLError, TimeoutError, ValueError) as error:
            record["error"] = str(error)
        record["elapsed_s"] = round(time.monotonic() - started, 2)
        results.append(record)
        output.write_text(
            json.dumps(
                {"ran_at": datetime.now(timezone.utc).isoformat(), "results": results},
                ensure_ascii=False,
                indent=2,
            )
            + "\n"
        )
        body = record.get("response", {})
        parsed = body.get("parsed", {})
        hotels = body.get("results", [])
        print(
            f"{number:02d} {record.get('status', 'ERR')} "
            f"city={parsed.get('location_hint')} hotels={len(hotels)} "
            f"unmatched={parsed.get('unmatched_terms')} "
            f"top={hotels[0]['hotel']['name'] if hotels else '-'} "
            f"{record['elapsed_s']}s",
            flush=True,
        )


if __name__ == "__main__":
    main()
