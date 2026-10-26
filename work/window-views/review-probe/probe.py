import asyncio
import json
import os
from pathlib import Path
from hotel_agent.composition import build_llm
from hotel_agent.settings import load_settings
from hotel_agent.adapters.log.stdlib import StdlibLogger
from hotel_agent.adapters.registry.yaml_loader import YamlCharacteristicRegistry

async def run():
    settings = load_settings(os.environ)
    registry = YamlCharacteristicRegistry.from_directory(settings.characteristics_dir)
    llm = build_llm(settings, registry, StdlibLogger('view_probe', info=True))
    payload = Path('/tmp/view-probe-input.json').read_text()
    try:
        verdicts = await llm.verify_evidence(payload)
        sources = {r['record_id']:r['source_text'] for r in json.loads(payload)['records']}
        print(json.dumps([{'id':v.record_id,'supported':v.supported,'quote':v.quote,'quote_grounded':v.quote in sources.get(v.record_id, "")} for v in verdicts],ensure_ascii=False))
    finally:
        await llm.aclose()

asyncio.run(run())
