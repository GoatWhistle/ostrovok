import asyncio
import json
import os
from pathlib import Path

from hotel_agent.application.agent.recommendation_review import recommendation_claim
from hotel_agent.application.agent.wish_evidence import native_facts, wish_intent
from hotel_agent.application.fact_records import fact_from_record
from hotel_agent.application.ports.requested_evidence import RequestedEvidence
from hotel_agent.composition import build_providers
from hotel_agent.adapters.log.stdlib import StdlibLogger
from hotel_agent.domain.characteristics import Op
from hotel_agent.domain.query import Intent, ParsedQuery
from hotel_agent.domain.services.scoring import score
from hotel_agent.settings import load_settings


async def main():
    providers = build_providers(load_settings(os.environ), StdlibLogger('review-diagnostic', info=False))
    try:
        wanted = Intent(characteristic_key='noise_level', op=Op.LTE, value=3,
                        weight=1, required=False, source_text='тихий отель')
        async with providers.uow() as uow:
            bbox = await uow.regions.city_bbox('Сочи')
            hotels = await uow.search.list_hotels('sochi', None)
            raw = await uow.search.list_facts(None, hotel_ids=tuple(h.id for h in hotels), characteristic_keys=('noise_level',))
        now = providers.clock.now()
        evidence = native_facts('тихий отель', RequestedEvidence((wanted,), tuple(raw)), now)
        if not any(row.value is True for row in evidence):
            print(json.dumps({'hotels':len(hotels),'facts':len(raw),'sample':[{ 'value':r.value,'unit':r.unit,'computed_at':r.computed_at.isoformat(),'valid_until':r.valid_until.isoformat() if r.valid_until else None} for r in raw[:5]],'verdict_values':[r.value for r in evidence[:5]]},ensure_ascii=False));return
        positive = next(row for row in evidence if row.value is True)
        hotel = next(h for h in hotels if h.id == positive.hotel_id)
        intent = wish_intent('тихий отель')
        parsed = ParsedQuery(intents=(intent,), unmatched_terms=(), location_hint='Сочи')
        scored = score((intent,), {positive.characteristic_key: fact_from_record(positive)}, now)
        claim = recommendation_claim(hotel, scored, parsed)
        context = json.dumps({'mode':'recommendation_scope','request':'Нужен тихий отель в Сочи',
                              'wish':'Проверь соответствие ответа смыслу запроса и подтверждениям источников.',
                              'records':[{'record_id':claim.id,'proposed_answer':claim.answer,'source_text':claim.evidence}]},ensure_ascii=False)
        verdicts = await providers.llm.verify_evidence(context)
        result = {'claim':{'id':claim.id,'answer':claim.answer,'evidence':json.loads(claim.evidence)},
                  'verdicts':[{'id':v.record_id,'supported':v.supported,'quote':v.quote,
                               'grounded':v.quote in claim.evidence} for v in verdicts]}
        print(json.dumps(result,ensure_ascii=False,indent=2))
    finally:
        await providers.aclose()

asyncio.run(main())
