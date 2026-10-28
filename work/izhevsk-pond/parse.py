import asyncio, os,json
from dataclasses import asdict
from hotel_agent.settings import load_settings
from hotel_agent.composition import build_providers
from hotel_agent.adapters.log.stdlib import StdlibLogger
import hotel_agent.adapters.llm.prompts as prompts
prompts.PARSE_QUERY_SYSTEM += '\nДля вида на природный объект, названный только типом (пруд, река, озеро), используй контекст города, чтобы восстановить полное известное географическое название в spatial_requests.target. Это поисковая гипотеза, которую проверят по реальным объектам карты, а не доказательство вида. Не оставляй target одним родовым словом, если из города понятен именованный объект. Если однозначный объект неизвестен, не выдумывай название; задай уточняющий вопрос. Пруд, озеро и водохранилище: target_osm_key=natural, target_osm_values=["water"]. source_text сохраняй дословно из запроса.'
async def main():
 p=build_providers(load_settings(os.environ),StdlibLogger('probe'))
 try:
  q=await p.llm.parse_query('отель в ижевске с видом на пруд')
  print(json.dumps(asdict(q),ensure_ascii=False,default=str))
 finally: await p.aclose()
asyncio.run(main())
