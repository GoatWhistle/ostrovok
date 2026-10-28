import json
import sys

payload = json.load(open(sys.argv[1]))
search = payload.get('search') or payload
assert search['parsed']['needs_clarification'] is False, 'Named lake requires a city'
assert search['results'], 'No hotels found near the lake'
for result in search['results']:
    assert any(
        'контура' in row.get('explanation', '') and row.get('geo_refs')
        for row in result['matched']
    ), 'No boundary distance evidence'
print('PASS:', len(search['results']), 'hotels with object boundary evidence, no city question')
