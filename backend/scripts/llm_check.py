import asyncio
import os
import sys

from hotel_agent.adapters.log.stdlib import StdlibLogger
from hotel_agent.composition import build_providers
from hotel_agent.settings import load_settings

QUERY = "тихий номер с видом на закат недалеко от моря"
ANSWER = "С собаками до 10 кг можно, 1500 ₽ в сутки, кошек тоже берём"


async def main() -> int:
    settings = load_settings(os.environ)
    providers = build_providers(settings, StdlibLogger("llm_check"))
    print(f"provider={providers.llm.provider} model={settings.llm_model}")
    try:
        parsed = await providers.llm.parse_query(QUERY)
        print(f"\nquery: {QUERY}")
        for intent in parsed.intents:
            print(
                f"  {intent.characteristic_key} {intent.op} {intent.value}"
                f"  weight={intent.weight} required={intent.required}"
                f"  <- {intent.source_text!r}"
            )
        print(f"  unmatched: {parsed.unmatched_terms} location: {parsed.location_hint}")

        question = await providers.llm.formulate_question("pets_policy", "missing", "Приморская")
        print(f"\nquestion: {question.text}")

        extraction = await providers.llm.extract_fields("pets_policy", ANSWER)
        print(f"\nanswer: {ANSWER}")
        for field in extraction.fields:
            print(f"  {field.name} = {field.value!r}  <- {field.quote!r}")
    finally:
        await providers.aclose()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
