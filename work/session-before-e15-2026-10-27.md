# Session state archived before E15, 2026-10-27

Moved from `context/SESSION.md` after the rebase onto `85bcd18`; kept verbatim.

## Historical state

- Stand worktree `fix/stand-agent-integration`/d335a31. Current root snapshot merged;76 verified delta files synced back to root without resetting/staging its prior work.737 backend checks (including integration),328 frontend tests/36 rules pass.
- Main :8080 healthy on `window-integrated-20261026d`, backend image5ebea97d, frontend index--3cQvo5k.js. New loop, stable verifier, candidate eligibility, chat consultation, height/geography updates integrated. [Refresh](../work/stand-refresh/README.md).
- Full50 round4 running exec88733; immutable-image guard enabled,900s observation timeout. Read round4/run.json and poll handle; do not restart while running. Prior round3 invalidated by container replacement. Goal incomplete.

- Web research round3 done on feat/hotel-agent-mvp: review rejection fed back into research, catalogue identity passed to the final review, duplicate wish researched once, contact User-Agent and typed page failures. 845 unit/contract, ruff, mypy, import contracts pass.

- Live run of all 12 cases: no false confirmations, 4 criteria met, 1 partial (poet quote proves death, not residence), 7 misses, four of them at the 180s wish limit. Details work/web-search-fix/round3/README.md; next actions work/web-search-fix/remaining.md.

- Window-view work stopped at user request. Remaining actions and Onega fallback-loss reproduction: [handoff](../work/window-views/remaining-actions.md). No more tests until resumed. All task code merged/pushed2d2fd12; handoff48575ae committed/pushed. Stand left running.

- Proximity wishes now start from map data: a forced find_nearby probe (20 km, distance to the nearest match), explicit instruction to finish on that distance field, per-tool budgets, time notices at 60/85 percent and an honest early finish. Kostroma moose farm 193s/empty → 65s/2 hotels with 13 km distance; «The Бык» 189 → 164s honest refusal (absent from OSM); Trump 58.8s. A source now must state the asked relation: an event inside a building no longer proves residence. Pushed as cd7e3ba.

- «Запросы не идут» checked: not the provider — one llm_request_retry (ReadTimeout, recovered) in the whole container log. «отель рядом с The бык в Казани» hit the 180s wish limit after 16 web searches; no such place in the Kazan OSM slice («Голодный бык» resolves in 12.5s). Added find_nearby over map data and a per-wish tool budget (web 8, pages 10, embeddings 8, expansions 3), pushed as b143c3c, stand on named-nearby-20261027b.

- Named place nearby no longer replaced by its category (user report: Вкусвилл, шаверма): name from the query is matched over OSM name/brand/operator/cuisine by word stems, found objects are listed in the explanation, source quote is shown in the card, planner context is compacted, a timed-out check is named as unfinished. Live: Вкусвилл 36.4s/20 hotels, шаверма 31.0s/20 hotels, regression round4 kept every earlier positive and added «Ямской посад». Pushed as ccf36c8; stand runs hotel-agent-backend:named-nearby-20261027.

- Previous round committed and pushed as deeeb60 on feat/hotel-agent-mvp. Stand runs hotel-agent-backend:research-feedback-20261026, built from this tree and byte-identical to backend/src (healthy; Trump query returns The Carlton Moscow in 51s over HTTP, poet repeat timed out empty in 243s). Frontend and db untouched. Docs of other sessions left dirty on purpose.

- Сведения об отелях Островка переписаны с поиска по прямоугольнику на каталог сайта: multicomplete по «название + улица/город», проверка кандидата по координатам и адресу его страницы, цены отдельным вызовом hp/search. Пришли фотографии, категории номеров с фото, услуги, описание, окружение с расстояниями, оценка и факты (этажи, число номеров, год постройки, запись реестра со ссылкой). Поле `details` добавлено в `/hotels/{id}/offers` и в openapi; карточка на фронте показывает это новым блоком. `GetHotelDetails` отдаёт то же агенту без дат, поэтому `provider_hotels`/`provider_rooms` перестали отвечать «not configured» в бесплатном режиме. Поиск по bbox удалён вместе с `ostrovok_content.py`/`ostrovok_details.py`.
- Измерено на тех же отелях: было (worktree на f1472e7) 0/9, 3/25, 4/40 с 10 provider_error; стало 9/9, 10/25, 9/40 без ошибок. Ложных совпадений нет, все принятые в 1–67 м с совпадающим адресом. Разброс источника: два прогона подряд дали 10 и 9 из 40. Подробности work/hotel-data/catalog-match/README.md, числа в docs/evidence.md.
- Backend 892 unit/contract, ruff, mypy 485, import contracts; frontend verify 36 правил/369 тестов/сборка. Стенд: hotel-agent-backend:supplier-details-20261027c и hotel-agent-frontend:supplier-details-20261027c, оба healthy, `/hotels/w51847429/offers` отдаёт 48 тарифов, 15 категорий и 24 фото.
- Не сделано: браузерный проход по новому блоку карточки на 375/1440 в двух темах и языках — карточка открывается только после поиска агентом, это платный вызов модели, явного разрешения не было. Блок покрыт четырьмя компонентными тестами на реальном ответе (work/hotel-data/catalog-match/live-card.json).
- Ничего не коммитил: в этом дереве параллельно работают другие сессии, их правки лежат в тех же docs/*.md. Все изменения в рабочем дереве на feat/hotel-agent-mvp поверх 6e59442.
