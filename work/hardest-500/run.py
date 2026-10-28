import argparse
import asyncio
import json
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent


def normalize(value):
    return str(value or "").casefold().replace("ё", "е").replace("-", " ").strip()


async def one(client, case, output, semaphore):
    async with semaphore:
        started = time.monotonic()
        report = {"id": case["id"], "group": case["group"], "expect": case["expect"],
                  "query": case["query"], "errors": []}
        try:
            response = await client.post(
                "/api/v1/chat/messages", json={"message": case["query"], "region_id": "russia"}
            )
            report["http_status"] = response.status_code
            if response.status_code != 200:
                report["errors"].append(f"http_{response.status_code}")
                report["body"] = response.text[:500]
                return report
            body = response.json()
            (output / f"{case['id']}.json").write_text(
                json.dumps(body, ensure_ascii=False, indent=1)
            )
            report["effective_query"] = body.get("effective_query")
            messages = body.get("messages") or []
            reply = next(
                (
                    m.get("content", "")
                    for m in reversed(messages)
                    if m.get("role") == "assistant"
                ),
                "",
            )
            report["reply"] = reply
            search = body.get("search") or {}
            parsed = search.get("parsed") or {}
            results = search.get("results") or []
            report["results"] = len(results)
            report["rejected"] = len(search.get("rejected") or [])
            report["took_ms"] = search.get("took_ms")
            report["needs_clarification"] = bool(parsed.get("needs_clarification"))
            report["location_hint"] = parsed.get("location_hint")
            report["unsupported_region"] = parsed.get("unsupported_region")
            report["scores"] = [r.get("score") for r in results]
            report["unconfirmed_full"] = [
                m.get("label")
                for r in results
                for m in (r.get("matched") or [])
                if m.get("match") == "full" and not m.get("fact")
            ]
        except asyncio.CancelledError:
            report["errors"].append("cancelled")
            raise
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as error:
            report["errors"].append(f"{type(error).__name__}: {error}")
        finally:
            report["seconds"] = round(time.monotonic() - started, 2)
            print(report["id"], report["seconds"], report.get("http_status"),
                  "results=" + str(report.get("results")), flush=True)
        return report


async def run(args):
    cases = json.loads((ROOT / "cases-500.json").read_text())
    if args.ids:
        wanted = set(args.ids.split(","))
        cases = [c for c in cases if c["id"] in wanted or c["group"] in wanted]
    output = ROOT / args.output
    output.mkdir(parents=True, exist_ok=True)
    semaphore = asyncio.Semaphore(args.concurrency)
    async with httpx.AsyncClient(base_url=args.base, timeout=args.timeout) as client:
        reports = await asyncio.gather(
            *(one(client, case, output, semaphore) for case in cases)
        )
    reports = sorted(reports, key=lambda item: item["id"])
    (output / "summary.json").write_text(json.dumps(reports, ensure_ascii=False, indent=1))
    print("saved", output / "summary.json", flush=True)


parser = argparse.ArgumentParser()
parser.add_argument("--base", default="http://127.0.0.1:8000")
parser.add_argument("--output", required=True)
parser.add_argument("--ids")
parser.add_argument("--concurrency", type=int, default=4)
parser.add_argument("--timeout", type=float, default=300)
asyncio.run(run(parser.parse_args()))
