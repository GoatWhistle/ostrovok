import asyncio
import json
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
from time import monotonic

from hotel_agent.adapters.external.gbif import GBIFObservations
from hotel_agent.adapters.geo.worldcover import WorldCover
from hotel_agent.adapters.weather.met_norway import MetNorwayConditions
from hotel_agent.application.ports.place_research import PlaceResearchRequest


async def main() -> None:
    weather = MetNorwayConditions("HotelAgent/0.1 (https://github.com/GoatWhistle/o-hack)")
    wildlife = GBIFObservations()
    started = monotonic()
    tasks = {
        "weather": weather.forecast({"sochi_probe": (39.72, 43.58)}, datetime.now(UTC)),
        "wildlife": wildlife.research(PlaceResearchRequest((39.72,43.58),2000,"Pica pica")),
        "landcover": WorldCover().research(PlaceResearchRequest((39.72,43.58),500)),
    }
    try:
        results = await asyncio.gather(*tasks.values(), return_exceptions=True)
        report = {"retrieved_at":datetime.now(UTC).isoformat(),"location":[39.72,43.58],
                  "elapsed_s":round(monotonic()-started,3), "llm_called":False,"stand_restarted":False,
                  "results":{name:{"error":str(result)} if isinstance(result,BaseException)
                             else asdict(result) if hasattr(result,"__dataclass_fields__") else result
                             for name,result in zip(tasks,results,strict=True)}}
        Path(__file__).resolve().parent.joinpath("free-tools-probe.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
        print(json.dumps(report,ensure_ascii=False))
    finally:
        await weather.aclose()
        await wildlife.aclose()


asyncio.run(main())
