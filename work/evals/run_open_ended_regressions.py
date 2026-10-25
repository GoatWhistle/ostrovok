import json
import runpy
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

root = Path(__file__).resolve().parent
runner = runpy.run_path(str(root / 'run_open_ended_20.py'))
run = runner['run']
output = root / 'open-ended-regressions.json'
if output.exists():
    raise FileExistsError(output)
run.__globals__['OUTPUT'] = output
cases = [case for case in json.loads((root/'open-ended-20-cases.json').read_text())
         if case['id'] in {'fresh-underwater','context-underwater','hammam','sochi-conference','zoo'}]
cases.insert(0, {'id':'novorossiysk', 'query':'на берегу моря в Новороссийске с рестораном',
    'expect':'novorossiysk', 'conversation_id':'9e98647c-333b-4e8a-a0b1-3150b19d4169'})
(root/'open-ended-regression-cases.json').write_text(json.dumps(cases,ensure_ascii=False,indent=2)+'\n')
with ThreadPoolExecutor(max_workers=2) as executor:
    list(executor.map(run, cases))
