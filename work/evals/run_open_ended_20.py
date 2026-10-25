import json
import runpy
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / 'open-ended-20-results.json'
LOCK = threading.Lock()
RESULTS = []
API = runpy.run_path(str(ROOT / 'run_diverse_50.py'))


def run(case):
    payload = {'message': case['query'], 'region_id': 'russia', 'locale': 'ru'}
    if case.get('conversation_id'):
        payload['conversation_id'] = case['conversation_id']
    if case['id'] == 'context-underwater':
        payload['conversation_id'] = '205e236b-1226-407e-bcb2-5ec0d3d805f4'
    started = time.monotonic()
    record = {'case': case}
    try:
        status, body = API['request']('/api/v1/chat/messages', payload)
        record.update(status=status, elapsed_s=round(time.monotonic()-started,2), raw=body)
        checks = {'http': status == 200}
        if status == 200:
            summary = API['summarize'](body)
            record['summary'] = summary
            parsed, answer = summary['parsed'], summary['answer'].casefold()
            if case['expect'].startswith('anywhere'):
                checks['anywhere'] = parsed.get('anywhere') is True
                checks['no_city_loop'] = 'в каком городе' not in answer
            if case['expect'] == 'anywhere_empty':
                checks['no_unverified_recommendations'] = summary['result_count'] == 0
            if case['expect'] == 'anywhere_positive':
                checks['positive_evidence'] = summary['result_count'] > 0 and any(
                    item['match'] in {'partial','full'} and item.get('fact')
                    for item in summary['top_results'][0]['matched'])
            if case['expect'] == 'ask_place':
                checks['asks_place'] = parsed['needs_clarification'] and not parsed['location_hint']
            if case['expect'] == 'place':
                checks['place_kept'] = bool(parsed['location_hint'])
            if case['expect'] == 'novorossiysk':
                checks['no_false_contradiction'] = not parsed['needs_clarification']
                checks['has_results'] = summary['result_count'] > 0
                checks['capital_with_evidence'] = any(item['hotel']['id'] == 'w711007670'
                    and sum(m['match'] in {'partial','full'} for m in item['matched']) >= 2
                    for item in summary['top_results'])
            record['links'] = API['inspect_links'](body['search'])
        record['checks'] = checks
        record['passed'] = all(checks.values())
    except Exception as error:
        record.update(error=type(error).__name__+': '+str(error), passed=False)
    with LOCK:
        RESULTS.append(record)
        OUTPUT.write_text(json.dumps(sorted(RESULTS,key=lambda row: row['case']['id']),
                                    ensure_ascii=False,indent=2)+'\n')
        print(case['id'], 'PASS' if record['passed'] else 'FAIL', record.get('status'),
              record.get('elapsed_s'), record.get('checks', record.get('error')), flush=True)
    return record


if __name__ == '__main__':
    if OUTPUT.exists():
        raise FileExistsError(OUTPUT)
    assert API['request']('/api/v1/health')[0] == 200
    cases = json.loads((ROOT/'open-ended-20-cases.json').read_text())
    with ThreadPoolExecutor(max_workers=2) as executor:
        list(executor.map(run, cases))
    print('passed',sum(row['passed'] for row in RESULTS),'of',len(RESULTS),flush=True)
