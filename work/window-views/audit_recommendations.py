import argparse
import json
from pathlib import Path


def audit(directory: Path) -> dict[str, object]:
    reports = []
    for path in sorted(directory.glob('*-search.json')):
        body = json.loads(path.read_text())
        findings = []
        for result in body.get('results', []):
            matches = result.get('matched', [])
            if matches and not any(item.get('match') in {'full', 'partial'} for item in matches):
                findings.append({
                    'hotel_id': result['hotel']['id'],
                    'error': 'recommended_without_any_satisfied_wish',
                    'qualities': [item.get('match') for item in matches],
                })
        reports.append({'case': path.name.removesuffix('-search.json'), 'findings': findings})
    return {'scope': 'supplementary relevance audit; geometric audit is separate', 'reports': reports}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('directory', type=Path)
    args = parser.parse_args()
    result = audit(args.directory)
    (args.directory / 'recommendation-audit.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps(result, ensure_ascii=False, indent=2))
