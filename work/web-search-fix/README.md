# General web research repair

User request: «все равно запросы не работают. Надо пофиксить и прогнать похожие максимально случайные запросы».

Baseline: trace.py against the actual runtime, real database and model; baseline.log ends with zero hotels for the original request. It finds the historical name but cannot get a catalogue ID: read_records and match_records verify the wish, rather than listing identity candidates. The first-2400-character evidence limit independently reproduced in red-check.txt.

Changes: catalogue identity lookup by names/aliases/address, full bounded source text, identity metadata supplied to verification, request-local page reuse, immediate preservation of verified page results, semantic verification permits grammatical differences for already verified fields only. No named-person/hotel exceptions.

First fixed trace returned The Carlton Moscow. First batch original:40.5s,1hotel; poet:251.2s,Angleterre. Main HTTP original:116.7s,1hotel (main-result.json). Initial batch interrupted after a second generic bug was identified: tower source checks matched but literal query guard discarded them. paraphrase-red.txt reproduces it. Round2 reruns all12 preregistered cases with this fix and source reuse. The set includes history, architecture, events, surroundings and an impossible condition. Cases and acceptance criteria were written before running. Counts of hotels are not treated as correctness on their own.

The main container is also deployed by a concurrent session; final image and source checks must be recorded after all changes.

## Третий круг, 26–27 октября 2026

Исправлены: возврат отказа итоговой проверки в исследование, передача каталожной идентичности
проверяющему, однократное исследование повторённого пожелания, контактный User-Agent и
различимые причины отказа страниц с канонизацией адреса и памятью отказов. Прогон всех
двенадцати случаев, развёртывание и проверка стенда описаны в [round3/README.md](round3/README.md),
ручная проверка источников — в [round3/source-verification.md](round3/source-verification.md),
оставшиеся действия — в [remaining.md](remaining.md).
