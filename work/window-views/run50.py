import argparse
import asyncio
import json
import subprocess
import time
from pathlib import Path

import httpx
from pyproj import Geod

ROOT = Path(__file__).resolve().parent
FLOORS = {"isaac_floor1": (1, 1), "isaac_floor7": (7, 7), "kulsharif_low": (1, 1), "kulsharif_high": (10, 200), "sea_floor1": (1, 1), "sea_floor8": (8, 8), "sea_adler": (2, 2), "sea_gel": (3, 3), "sea_anapa": (5, 5), "elbrus_low": (1, 1), "volga_samara": (2, 2)}
DIRECTIONS = {"isaac_west": 270, "sea_east": 90, "sea_west": 270}
SPECIAL = {"no_city", "ambiguous", "impossible_floor", "fictional", "opposite"}


def normalize(value):
    return str(value or "").casefold().replace("ё", "е").replace("-", " ")


def audit_ray(visibility):
    errors = []
    observer, target = visibility.get("observer_elevation_m"), visibility.get("target_elevation_m")
    distance = visibility.get("distance_m", 0)
    if visibility.get("observer_location") and visibility.get("target_location"):
        distance = Geod(ellps="WGS84").inv(*visibility["observer_location"], *visibility["target_location"])[2]
    if not observer or not target or distance <= 0:
        return ["missing_observer_or_target_height"]
    confirmed, uncertain = [], []
    itself = {visibility.get("target_id"), visibility.get("target_part_id")} - {None}
    for obstacle in visibility.get("profile", []):
        d, top, bottom = obstacle["distance_m"], obstacle["elevation"], obstacle.get("bottom")
        if not 0 < d < distance or obstacle["id"] in itself:
            continue
        ratio = d / distance
        bulge = (6 / 7) * d * (distance - d) / (2 * 6371008.8)
        lower_line = observer["minimum_m"] * (1 - ratio) + target["minimum_m"] * ratio
        upper_line = (observer["maximum_m"] * (1 - ratio) + target["maximum_m"] * ratio if observer["maximum_m"] is not None and target["maximum_m"] is not None else None)
        if bottom and upper_line is not None and bottom["minimum_m"] + bulge - upper_line >= .19:
            continue
        if top is None or top["maximum_m"] is None:
            uncertain.append(obstacle["id"])
            continue
        if lower_line - top["maximum_m"] - bulge < .19:
            uncertain.append(obstacle["id"])
        if upper_line is not None and top["minimum_m"] + bulge - upper_line > .21:
            if bottom is None or (bottom["maximum_m"] is not None and lower_line > bottom["maximum_m"] + bulge + .21):
                confirmed.append(obstacle["id"])
    if visibility["status"] == "visible":
        if not visibility.get("complete_coverage") or visibility.get("unknown_obstacles"):
            errors.append("clear_without_complete_known_coverage")
        if confirmed or uncertain:
            errors.append("clear_ray_crosses_profile_obstruction")
    if visibility["status"] == "blocked" and not confirmed:
        errors.append("blocked_without_independent_intersection")
    if visibility.get("bookable_room_confirmed"):
        errors.append("invented_confirmed_bookable_room")
    return errors


def audit_target(case, visibility):
    name = case["id"]
    tags = visibility.get("target_tags", {})
    errors = []
    mountain = name in {"elbrus", "elbrus_low", "mashuk", "beshtau", "klyuchevskaya", "avacha"}
    water = name in {"neva", "volga_nizhny", "volga_samara", "volga_volgograd", "yenisei", "teletskoye", "onega"}
    if mountain and tags.get("natural") not in {"peak", "volcano", "hill"}:
        errors.append("target_is_not_requested_mountain")
    if water and not (tags.get("natural") == "water" or tags.get("waterway") == "river"):
        errors.append("target_is_not_requested_water_body")
    if name == "kazan" and tags.get("historic") not in {"castle", "fort"}:
        errors.append("target_is_not_kazan_fortress")
    if name.startswith("ostankino") and tags.get("man_made") != "tower":
        errors.append("target_is_not_television_tower")
    if name.startswith("elbrus") and visibility.get("distance_m", 0) < 20000:
        errors.append("elbrus_target_is_wrongly_inside_kislovodsk")
    return errors


async def check(client, case, output):
    started = time.monotonic()
    report = {"id": case["id"], "query": case["query"], "errors": [], "hotels": []}
    try:
        response = await client.post("/api/v1/search", json={"query": case["query"], "limit": 5})
        report["http_status"] = response.status_code
        if response.status_code != 200:
            report["errors"].append("search_http_failure")
            (output / f"{case['id']}-error.txt").write_text(response.text)
            return report
        body = response.json()
        (output / f"{case['id']}-search.json").write_text(json.dumps(body, ensure_ascii=False, indent=2))
        report["parsed"] = body.get("parsed")
        parsed = body.get("parsed", {})
        if parsed.get("needs_clarification"):
            report["clarification"] = True
            if case["id"] not in SPECIAL:
                report["errors"].append("unexpected_clarification_for_resolvable_view")
            return report
        expected = case.get("expected_location")
        location = normalize(parsed.get("location_hint"))
        aliases = {"санкт петербург": {"петербург", "спб"}, "сочи": {"адлер"}}
        if expected and normalize(expected) not in location and location not in aliases.get(normalize(expected), set()):
            report["errors"].append("wrong_location")
        if not body.get("results") and case["id"] not in SPECIAL:
            report["errors"].append("no_results_for_resolvable_target")
        calculated = 0
        for result in body.get("results", []):
            hotel_report = {"id": result["hotel"]["id"], "name": result["hotel"]["name"], "views": []}
            for item in result.get("matched", []):
                fact = item.get("fact")
                if not fact:
                    continue
                detail_response = await client.get(f"/api/v1/hotels/{hotel_report['id']}/facts/{fact['fact_id']}")
                if detail_response.status_code != 200:
                    report["errors"].append("fact_card_http_failure")
                    continue
                detail = detail_response.json()
                if detail.get("provenance", {}).get("method") != "window_visibility@1":
                    continue
                filename = f"{case['id']}-{hotel_report['id']}-{fact['fact_id']}.json"
                (output / filename).write_text(json.dumps(detail, ensure_ascii=False, indent=2))
                visibility = detail.get("qualifiers", {}).get("visibility", {})
                status = visibility.get("status")
                expected_value = True if status == "visible" else False if status == "blocked" else None
                if detail.get("value") is not expected_value:
                    report["errors"].append("status_value_mismatch")
                if visibility.get("target_location"):
                    calculated += 1
                    report["errors"].extend(audit_ray(visibility))
                    report["errors"].extend(audit_target(case, visibility))
                    low, high = FLOORS.get(case["id"], (1, 200))
                    if not low <= visibility.get("floor", 0) <= high:
                        report["errors"].append("requested_floor_not_respected")
                    if case["id"] in DIRECTIONS and abs((visibility["facade_azimuth_deg"] - DIRECTIONS[case["id"]] + 180) % 360 - 180) > 45:
                        report["errors"].append("requested_facade_not_respected")
                    if case["id"].startswith("isaac") and visibility.get("target_id") != "r3229838":
                        report["errors"].append("isaac_target_is_not_cathedral")
                    refs = detail.get("geo_refs", [])
                    geometry_response = await client.post("/api/v1/geo-features:batch", json={"ids": refs})
                    if geometry_response.status_code != 200:
                        report["errors"].append("map_evidence_http_failure")
                    else:
                        features = geometry_response.json().get("features", [])
                        if {feature["id"] for feature in features} != set(refs):
                            report["errors"].append("missing_persisted_map_geometry")
                        lines = [feature for feature in features if feature["properties"].get("kind") == "line"]
                        if not lines or any(abs(a-b) > 1.1e-9 for actual, expected in zip(lines[0]["geometry"]["coordinates"], [visibility["observer_location"], visibility["target_location"]], strict=True) for a,b in zip(actual, expected, strict=True)):
                            report["errors"].append("map_ray_differs_from_computed_ray")
                elif not visibility.get("reason"):
                    report["errors"].append("unknown_without_source_reason")
                hotel_report["views"].append({"status": status, "target": visibility.get("target_name"), "floor": visibility.get("floor"), "missing": visibility.get("missing"), "reason": visibility.get("reason"), "artifact": filename})
            report["hotels"].append(hotel_report)
        report["calculated_rays"] = calculated
        if calculated == 0 and case["id"] not in SPECIAL:
            report["errors"].append("no_geometric_target_evidence")
    except asyncio.CancelledError:
        report["errors"].append("cancelled_before_completion")
        raise
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as error:
        report["errors"].append(type(error).__name__ + ": " + str(error))
    finally:
        report["seconds"] = round(time.monotonic() - started, 2)
        report["errors"] = sorted(set(report["errors"]))
        report["passed_automatic_audit"] = not report["errors"]
        (output / f"{case['id']}-audit.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
        print(case["id"], report["seconds"], report["errors"], flush=True)
    return report


async def run(args):
    cases = json.loads((ROOT / "cases-50.json").read_text())
    if args.ids:
        cases = [case for case in cases if case["id"] in args.ids.split(",")]
    output = ROOT / args.output
    output.mkdir(exist_ok=True)
    reports = []
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8080", timeout=args.timeout) as client:
        for case in cases:
            before = runtime_image()
            if args.expected_image and before != args.expected_image:
                interruption(output, case, args.expected_image, before)
                break
            reports.append(await check(client, case, output))
            after = runtime_image()
            if args.expected_image and after != args.expected_image:
                reports[-1]["errors"].append("runtime_image_changed")
                reports[-1]["passed_automatic_audit"] = False
                interruption(output, case, args.expected_image, after)
            (output / "summary.json").write_text(json.dumps(reports, ensure_ascii=False, indent=2))
            if args.expected_image and after != args.expected_image:
                break
            if reports[-1].get("http_status") in {502, 503, 504}:
                (output / "interruption.json").write_text(json.dumps({"case": case["id"], "reason": "service_unavailable", "remaining_cases_not_executed": True}))
                break
    print("automatic_audit", sum(item["passed_automatic_audit"] for item in reports), "/", len(reports), flush=True)


def runtime_image():
    result = subprocess.run(["docker", "inspect", "hotel-agent-backend-1", "--format", "{{.Image}}"], capture_output=True, text=True)
    return result.stdout.strip() if result.returncode == 0 else None


def interruption(output, case, expected, actual):
    report = {"case": case["id"], "reason": "runtime_image_changed", "expected_image": expected, "actual_image": actual, "remaining_cases_not_executed": True}
    (output / "interruption.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report), flush=True)


parser = argparse.ArgumentParser()
parser.add_argument("--ids")
parser.add_argument("--expected-image")
parser.add_argument("--timeout", type=float, default=180)
parser.add_argument("--output", default="round1")
asyncio.run(run(parser.parse_args()))
