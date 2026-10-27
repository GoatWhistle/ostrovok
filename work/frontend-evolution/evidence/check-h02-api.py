import json
import sys
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

BASE = "http://127.0.0.1:18085/api/v1"
HOTEL = "h_demo_hotelier"
OPEN = "q_h_demo_hotelier_room_capacity"
ANSWERED = "q_h_demo_hotelier_pets_policy"


def call(method: str, path: str, body: object | None = None) -> tuple[int, object]:
    data = json.dumps(body).encode() if body is not None else None
    request = Request(BASE + path, data=data, method=method)
    request.add_header("Content-Type", "application/json")
    try:
        with urlopen(request, timeout=10) as response:
            return response.status, json.loads(response.read())
    except HTTPError as error:
        return error.code, json.loads(error.read())


def status_of(question_id: str) -> str:
    _, body = call("GET", f"/hotelier/{HOTEL}/questions")
    assert isinstance(body, dict)
    return next(item["status"] for item in body["items"] if item["id"] == question_id)


steps: list[dict[str, object]] = []


def step(name: str, method: str, path: str, body: object | None, expected: int) -> object:
    code, payload = call(method, path, body)
    steps.append({"step": name, "status": code, "expected": expected, "body": payload})
    return payload


step("skip open question", "PATCH", f"/hotelier/questions/{OPEN}", {"status": "skipped"}, 200)
steps.append({"step": "list after skip", "observed": status_of(OPEN), "expected": "skipped"})
step("repeat skip", "PATCH", f"/hotelier/questions/{OPEN}", {"status": "skipped"}, 200)
step("reopen", "PATCH", f"/hotelier/questions/{OPEN}", {"status": "open"}, 200)
steps.append({"step": "list after reopen", "observed": status_of(OPEN), "expected": "open"})
step("skip answered", "PATCH", f"/hotelier/questions/{ANSWERED}", {"status": "skipped"}, 409)
step("reopen answered", "PATCH", f"/hotelier/questions/{ANSWERED}", {"status": "open"}, 409)
step("unknown id", "PATCH", "/hotelier/questions/q_missing", {"status": "skipped"}, 404)
step("answered body", "PATCH", f"/hotelier/questions/{OPEN}", {"status": "answered"}, 422)
step("extra field", "PATCH", f"/hotelier/questions/{OPEN}", {"status": "open", "x": 1}, 422)
_, listing = call("GET", f"/hotelier/{HOTEL}/questions")
steps.append({"step": "saved answers", "body": listing})
failures = [
    item["step"]
    for item in steps
    if ("status" in item and item["status"] != item["expected"])
    or ("observed" in item and item["observed"] != item["expected"])
]
answered = [
    item for item in listing["items"] if item["status"] == "answered"
] if isinstance(listing, dict) else []
if not answered or not all(item["answer_text"] and item["answer_fact_ids"] for item in answered):
    failures.append("answered questions lack saved text or fact links")
if status_of(OPEN) != "open":
    failures.append("demo question was not left open")
Path(__file__).with_name("h02-api.json").write_text(
    json.dumps({"steps": steps, "failures": failures}, ensure_ascii=False, indent=2) + "\n"
)
print(json.dumps({"failures": failures}))
sys.exit(1 if failures else 0)
