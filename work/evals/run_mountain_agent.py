import argparse
import json
import runpy
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run", required=True, type=int)
    parser.add_argument("--query", default="хочу отель высоко в горах около Владикавказа")
    args = parser.parse_args()
    output = ROOT / f"mountain-agent-live-{args.run}.json"
    if output.exists():
        raise FileExistsError(output)
    api = runpy.run_path(str(ROOT / "run_diverse_50.py"))
    deadline = time.monotonic() + 20
    while api["request"]("/api/v1/health")[0] != 200:
        if time.monotonic() >= deadline:
            raise RuntimeError("The main stand is not healthy")
        time.sleep(0.5)
    started = time.monotonic()
    status, body = api["request"]("/api/v1/chat/messages", {
        "message": args.query, "region_id": "russia", "locale": "ru",
    })
    record = {"query": args.query, "status": status,
              "elapsed_s": round(time.monotonic() - started, 2),
              "response": api["summarize"](body) if status == 200 else body}
    output.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n")
    print("HTTP", status, "elapsed", record["elapsed_s"])
    if status == 200:
        print("answer", record["response"]["answer"])
        print("parsed", record["response"]["parsed"])
        for row in record["response"]["top_results"]:
            print(row["hotel"]["name"], [(m["label"], m["match"], m["explanation"]) for m in row["matched"]])
    else:
        print(body)


if __name__ == "__main__":
    main()
