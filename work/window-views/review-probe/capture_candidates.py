import asyncio
import json
from pathlib import Path
import httpx
import hotel_agent.main as main
from hotel_agent.application.agent.recommendation_review import recommendation_claim
from hotel_agent.application.agent.semantic_review import ReviewResult
from hotel_agent.domain.query import ParsedQuery, SpatialRequest

TERM = 'с видом из окна на Исаакиевский собор'
QUERY = 'Хочу отель в Санкт-Петербурге ' + TERM
original = main.build_providers

def providers(*args, **kwargs):
    result = original(*args, **kwargs)
    async def parse(query):
        return ParsedQuery(intents=(), unmatched_terms=(), location_hint='Санкт-Петербург', wishes=(TERM,), spatial_requests=(SpatialRequest(kind='landmark_view', target='Исаакиевский собор', radius_m=10000, source_text=TERM),))
    result.llm.parse_query = parse
    return result

class Capture:
    def __init__(self, *args):
        pass
    async def check(self, query, parsed, candidates, limit):
        rows = []
        for hotel, scored in candidates:
            claim = recommendation_claim(hotel, scored, parsed)
            rows.append({'record_id':claim.id, 'score':scored.score, 'proposed_answer':claim.answer, 'source_text':claim.evidence})
        Path('/probe/current-candidates.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
        return ReviewResult(rejected_ids=tuple(hotel.id for hotel, _ in candidates))

async def run():
    main.build_providers = providers
    main.RecommendationReview = Capture
    app = main.create_app()
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url='http://capture') as client:
            response = await client.post('/api/v1/search', json={'query':QUERY,'limit':5})
            print(response.status_code)

asyncio.run(run())
