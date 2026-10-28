import json
import sys

payload = json.load(open(sys.argv[1]))
results = (payload.get('search') or {}).get('results') or []
assert results, 'No hotels returned for the Izhevsk pond view request'
assert payload['search']['parsed']['location_hint'] == 'Ижевск'
assert 'Проверка не завершена' not in payload['messages'][-1]['content']
for result in results:
    matches = result['matched']
    assert any(
        item.get('fact', {}).get('value') is True
        and 'Ижевский пруд' in item.get('explanation', '')
        and item.get('geo_refs')
        for item in matches
    ), 'Missing calculated view evidence for the actual pond'
print(f'PASS: {len(results)} hotels, Izhevsk, completed search')
