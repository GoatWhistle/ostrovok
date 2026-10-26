import gzip
import hashlib
import json
import time
from datetime import UTC, datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

BBOX = [39.55, 43.35, 40.0, 43.75]
FILTERS = ['[landuse]', '[landcover]', '[natural]', '[leisure]', '[waterway]', '[water]',
           '[railway]', '[man_made=pier]', '[amenity=parking]', '["building:colour"]',
           '[~"^roof:"~"."]']
QUERY = '[out:json][timeout:90];(' + ''.join(f'nwr{tag}(43.35,39.55,43.75,40.0);' for tag in FILTERS) + ');out body geom;'
TARGET = Path('data/raw/sochi-map-layers.json.gz')
ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']


def main() -> None:
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    if TARGET.exists():
        print(f'Using existing {TARGET}', flush=True)
        return
    failures = []
    for attempt, endpoint in enumerate(ENDPOINTS):
        try:
            print(f'Downloading Sochi bbox from {endpoint}', flush=True)
            request = Request(endpoint, data=urlencode({'data': QUERY}).encode(),
                              headers={'User-Agent': 'Factmap-map-prototype/0.1'})
            with urlopen(request, timeout=110) as response:
                raw = response.read(160_000_001)
            if len(raw) > 160_000_000:
                raise ValueError('Sochi response exceeds 160 MB guard')
            payload = json.loads(raw)
            if payload.get('remark'):
                raise ValueError(payload['remark'])
            with gzip.open(TARGET.with_suffix('.part'), 'wb') as output:
                output.write(raw)
            TARGET.with_suffix('.part').replace(TARGET)
            manifest = {'source': endpoint, 'bbox': BBOX, 'query': QUERY, 'fetched_at': datetime.now(UTC).isoformat(),
                        'osm_timestamp': payload.get('osm3s', {}).get('timestamp_osm_base'),
                        'license': 'ODbL-1.0', 'sha256': hashlib.sha256(raw).hexdigest(),
                        'elements': len(payload['elements']), 'failures': failures}
            TARGET.with_suffix('.manifest.json').write_text(json.dumps(manifest, indent=2))
            print(json.dumps(manifest), flush=True)
            return
        except (HTTPError, URLError, TimeoutError, ValueError) as error:
            failures.append({'source': endpoint, 'error': str(error)})
            print(f'Download failed: {error}', flush=True)
            time.sleep(3 * (attempt + 1))
    TARGET.with_suffix('.failure.json').write_text(json.dumps(failures, indent=2))
    raise SystemExit('Map layer download failed; current seed remains available')


if __name__ == '__main__':
    main()
