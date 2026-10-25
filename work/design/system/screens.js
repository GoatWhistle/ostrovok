import { icon } from "./icons.js"
import { buildMap, miniMap } from "./map.js"
import { chatAgent, chatChips, chatComposer, chatPanel, chatUser } from "./chat.js"

const MARK_SVG = `<svg class="lockup-mark mk-auto" viewBox="0 0 64 64" aria-hidden="true"><path class="mk-side mk-l" d="M5 14 22 8v42L5 56Z"/><path class="mk-mid" d="M25 8l14 6v42l-14-6Z"/><path class="mk-side mk-r" d="M42 14 59 8v42l-17 6Z"/></svg>`
const lockup = `<span class="lockup">${MARK_SVG}<span class="lockup-word">factmap</span></span>`

const ok = (s = 16) => icon("confirmed", s, "st st--ok")
const part = (s = 16) => icon("partial", s, "st st--part")
const no = (s = 16) => icon("rejected", s, "st st--no")

const HOTEL_ROWS = [
  { name: "Отель «Чайка»", seed: 3, score: "3/3", sel: true, area: "Центральный", walk: "6 мин", rows: [["quiet", "--hue-quiet", "Тихий фасад", ok()], ["sunset", "--hue-sunset", "Закат с 4-го", ok()], ["walk", "--hue-walk", "6 мин до пляжа", ok()]] },
  { name: "Апарт-отель «Ривьера»", seed: 9, score: "3/3", area: "Хоста", walk: "4 мин", rows: [["quiet", "--hue-quiet", "Тихий фасад", ok()], ["sunset", "--hue-sunset", "Закат с любого", ok()], ["walk", "--hue-walk", "4 мин до пляжа", ok()]] },
  { name: "Гостиница «Магнолия»", seed: 5, score: "2/3", area: "Центральный", walk: "9 мин", rows: [["quiet", "--hue-quiet", "Тихий фасад", ok()], ["sunset", "--hue-sunset", "Закат с 8-го", part()], ["walk", "--hue-walk", "9 мин, подъём", no()]] },
  { name: "Отель «Бриз»", seed: 12, score: "2/3", area: "Адлер", walk: "3 мин", rows: [["quiet", "--hue-quiet", "Шум 5 из 10", part()], ["sunset", "--hue-sunset", "Закат с 2-го", ok()], ["walk", "--hue-walk", "3 мин до пляжа", ok()]] },
]

const hotelCard = (h, compact) => `<article class="hotel" aria-selected="${Boolean(h.sel)}">
<div class="hotel-thumb">${miniMap(h.seed, h.seed % 3)}</div>
<div class="hotel-body"><div class="hotel-top"><h4 class="hotel-name" style="${compact ? "font-size: var(--font-size-body-sm)" : ""}">${h.name}</h4><span class="match-score">${icon(h.score === "3/3" ? "check" : "partial", 14)}${h.score}</span></div>
${compact ? "" : `<div class="hotel-meta"><span>${icon("pin")}${h.area}</span><span>${icon("walk")}${h.walk}</span></div>`}
<ul class="match-list">${h.rows.map(([ic, hue, t, st]) => `<li style="--hue: var(${hue})">${icon(ic)}<span><b>${t}</b></span>${st}</li>`).join("")}</ul></div></article>`

const chips = (keys) =>
  keys
    .map(([ic, hue, t]) => `<span class="chip" aria-pressed="true" style="--hue: var(${hue}); min-height: 30px"><span class="chip-dot" style="width:18px;height:18px">${icon(ic, 12)}</span>${t}</span>`)
    .join("")

const QUERY_CHIPS = [["quiet", "--hue-quiet", "Тихо"], ["sunset", "--hue-sunset", "Закат"], ["walk", "--hue-walk", "До моря"]]

const search = (value) => `<div class="hero-search">${icon("search")}<input type="text" value="${value}" aria-label="Запрос" tabindex="-1"><button class="btn btn--primary btn--compact" type="button" tabindex="-1">${icon("arrow-right", 18)}</button></div>`

const mapCtrls = `<div class="map-ctrls"><div class="map-ctrl"><button type="button" tabindex="-1" aria-label="Приблизить">${icon("zoom-in")}</button><button type="button" tabindex="-1" aria-label="Отдалить">${icon("zoom-out")}</button></div><div class="map-ctrl"><button type="button" tabindex="-1" aria-label="Слои">${icon("layers")}</button></div></div>`

const unk = (s = 16) => icon("unknown", s, "st st--unk")

const WS_HOTELS = [
  { ...HOTEL_ROWS[0], addr: "Приморская улица, 12" },
  { ...HOTEL_ROWS[1], addr: "Хоста, Платановая улица, 5" },
  { ...HOTEL_ROWS[2], addr: "Курортный проспект, 72" },
  { ...HOTEL_ROWS[3], addr: "Адлер, Набережная улица, 31" },
]

const wsScore = (score) => `<span class="match-score"${score === "3/3" ? "" : ' data-tone="partial"'}>${icon(score === "3/3" ? "check" : "partial", 14)}${score}</span>`
const wsMatches = (rows) => `<ul class="match-list">${rows.map(([ic, hue, t, st]) => `<li style="--hue: var(${hue})">${icon(ic)}<span><b>${t}</b></span>${st}</li>`).join("")}</ul>`

const wsHotel = (h, compact) => `<article class="hotel" aria-selected="${Boolean(h.sel)}"><div class="hotel-thumb">${miniMap(h.seed, h.seed % 3)}</div>
<div class="hotel-body"><div class="hotel-top"><h4 class="hotel-name">${h.name}</h4>${wsScore(h.score)}</div>${compact ? "" : `<div class="hotel-meta"><span>${icon("pin")}${h.addr}</span></div>`}${wsMatches(h.rows)}</div></article>`

const wsSeg = (items, active) => `<div class="segmented is-compact">${items.map(([k, l]) => `<button type="button" tabindex="-1" aria-checked="${k === active}"${k === active ? ' style="background: var(--surface-raised); border-radius: var(--radius-sm)"' : ""}>${l}</button>`).join("")}</div>`
const WS_TABS = [["chat", "Чат"], ["hotels", "Отели"], ["map", "Карта"]]

const wsTopFor = (current) => `<div class="scr-top">${lockup}<nav class="ws-nav" aria-label="Разделы"><span${current ? ' aria-current="page"' : ""}>${icon("search", 18)}Поиск отелей</span><span>${icon("hotelier", 18)}Отельеру</span></nav><span class="scr-spacer"></span>${wsSeg([["ru", "RU"], ["en", "EN"]], "ru")}<button class="btn btn--ghost btn--icon" type="button" tabindex="-1" aria-label="Тема">${icon("sun")}</button></div>`
const wsTop = wsTopFor(true)

const wsCount = (text) => `<div class="scr-count"><span>${text}</span><span class="select-trigger" style="width:auto;min-height:32px;font-size:var(--font-size-caption)">По совпадению${icon("chevron-down", 16, "chev")}</span></div>`

const WS_CHIPS = [["quiet", "--hue-quiet", "Тихо"], ["sunset", "--hue-sunset", "Закат из окна"], ["walk", "--hue-walk", "До моря пешком"]]
const WS_RESULT = `<p class="chat-lead">Нашёл 24 отеля.</p><div class="chat-part"><span class="chat-cap">Как я понял запрос</span>${chatChips(WS_CHIPS, true)}</div><div class="chat-actions"><button class="btn btn--fact btn--compact" type="button" tabindex="-1">${icon("map", 18)}Показать на карте</button></div>`

const wsComposer = () => chatComposer({ placeholder: "Тихий номер с видом на закат, недалеко от моря", hint: "Enter отправляет, Shift и Enter переносят строку" })

const wsChat = () => chatPanel({ log: `${chatUser("тихий номер с видом на закат недалеко от моря")}${chatAgent(WS_RESULT)}`, composer: wsComposer() })

const wsMap = (id) => `<div class="ws-map" data-pane="map">${buildMap({ id, seed: 11 })}${mapCtrls}</div>`

const wsScreen = (tab, panel, chat, mapId) => `${wsTop}<div class="ws-body" data-tab="${tab}"><div class="ws-tabs">${wsSeg(WS_TABS, tab)}</div>${panel}${wsMap(mapId)}${chat}</div>`

export const screenDesktop = () => wsScreen("chat", `<aside class="ws-panel" data-pane="hotels">${wsCount("<b>24 отеля</b> совпадают")}<div class="scroll-area">${WS_HOTELS.map((h) => wsHotel(h)).join("")}</div></aside>`, wsChat(), "sd")

const WS_FACTS = [
  ["sunset", "--hue-sunset", "Закат из окна", "с 4-го этажа из 9", "computed", "Расчёт"],
  ["height", "--hue-height", "Этажей в здании", "9", "hotelier", "Отельер"],
  ["walk", "--hue-walk", "До пляжа пешком", "6 мин, 420 м", "osm", "OSM"],
]

export const screenHotel = () => {
  const h = WS_HOTELS[0]
  const photo = miniMap(h.seed, h.seed % 3).replace("<svg ", '<svg preserveAspectRatio="xMidYMid slice" ')
  const facts = WS_FACTS.map(([ic, hue, t, v, src, name]) => `<div class="ws-fact" style="--hue: var(${hue})"><span class="fact-ic">${icon(ic, 18)}</span><div><b>${t}</b><span>${v}</span></div><span class="badge badge--neutral">${icon(src)}${name}</span></div>`).join("")
  const panel = `<aside class="ws-panel ws-panel--detail" data-pane="hotels"><div class="ws-back"><button class="btn btn--ghost btn--compact" type="button" tabindex="-1">${icon("chevron-left", 18)}Все отели</button><b>${h.name}</b></div>
<div class="scroll-area"><div class="ws-detail"><div class="ws-photo">${photo}</div>
<div class="ws-detail-head"><div><h4>${h.name}</h4><div class="hotel-meta"><span>${icon("pin")}${h.addr}</span><span>${icon("walk")}${h.walk}</span></div></div>${wsScore(h.score)}</div>
<div class="ws-sec"><span class="chat-cap">Совпадения</span>${wsMatches([...h.rows, ["pets", "--hue-pets", "С собакой: нет данных", unk()]])}</div>
<div class="ws-sec"><span class="chat-cap">Факты</span>${facts}</div>
<button class="btn btn--fact" type="button" tabindex="-1">${icon("map", 18)}Показать на карте</button></div></div></aside>`
  return wsScreen("hotels", panel, wsChat(), "sh")
}

const phTop = `<div class="ph-top"><span class="lockup">${MARK_SVG}<span class="lockup-word">factmap</span></span><button class="btn btn--ghost btn--icon btn--compact" type="button" tabindex="-1" aria-label="Тема">${icon("sun", 18)}</button></div>`

const PH_RESULT = `<p class="chat-lead">Нашёл 24 отеля.</p><div class="chat-part"><span class="chat-cap">Как я понял запрос</span>${chatChips([["quiet", "--hue-quiet", "Тихо"], ["sunset", "--hue-sunset", "Закат"], ["walk", "--hue-walk", "До моря"]], true)}</div><div class="chat-actions"><button class="btn btn--fact btn--compact" type="button" tabindex="-1">${icon("map", 18)}Показать на карте</button><button class="btn btn--ghost btn--compact" type="button" tabindex="-1">Список отелей</button></div>`

export const screenPhone = () => `<div class="phone-screen"><span class="phone-notch"></span>${phTop}<div class="ph-tabs">${wsSeg(WS_TABS, "chat")}</div>
<div class="ph-pane">${chatPanel({ head: false, cls: "chat--bare", log: `${chatUser("тихий номер с видом на закат")}${chatAgent(PH_RESULT)}`, composer: chatComposer({ placeholder: "Опишите отель словами" }) })}</div></div>`

export const screenPhoneList = () => `<div class="phone-screen"><span class="phone-notch"></span>${phTop}<div class="ph-tabs">${wsSeg(WS_TABS, "hotels")}</div>
<div class="ph-pane ph-pane--list">${wsCount("<b>24 отеля</b>")}${WS_HOTELS.map((h, i) => wsHotel({ ...h, sel: i === 0 }, true)).join("")}</div></div>`

const QUEUE = [
  ["blackout", "--hue-dark", "Шторы блэкаут в стандартных?", "14 вопросов", "warning", "Ждёт"],
  ["pets", "--hue-pets", "Можно с собакой до 10 кг?", "9 вопросов", "warning", "Ждёт"],
  ["height", "--hue-height", "Этажей в здании 9?", "конфликт", "conflict", "Конфликт"],
  ["sea", "--hue-sea", "Есть свой пляж?", "ответ 24.10", "success", "Готово"],
]

export const screenHotelier = () => `<div class="scr-top">${lockup}<span class="badge badge--info">${icon("hotelier")}Кабинет отельера</span><span class="scr-spacer"></span><span class="label">Отель «Чайка»</span></div>
<div class="hd-body"><div class="hd-queue">${QUEUE.map(([ic, hue, q, meta, b, st], i) => `<div class="hd-item" aria-selected="${i === 0}" style="--hue: var(${hue})"><span class="fact-ic">${icon(ic, 16)}</span><div><b>${q}</b><span>${meta}</span></div><span class="badge badge--${b}">${st}</span></div>`).join("")}</div>
<div class="hd-main"><div class="card-eyebrow">${icon("blackout", 16)}Шторы блэкаут, номера</div><p class="question-q">В стандартных номерах есть шторы блэкаут?</p><p class="question-why">Этот вопрос задают 14 путешественников за неделю. Ответ увидят все, он станет фактом с источником «отельер».</p>
<div class="question-actions"><button class="btn btn--confirm" type="button" tabindex="-1">${icon("check")}Да, есть</button><button class="btn btn--danger" type="button" tabindex="-1">${icon("x")}Нет</button><button class="btn btn--ghost" type="button" tabindex="-1">Не знаю</button></div>
<div class="banner" style="--b-bg: var(--status-info-surface); --b-ic: var(--status-info)">${icon("info")}<div><strong>Сейчас в выдаче: нет данных</strong><p>Отель теряет совпадения по запросам «темно и тихо».</p></div></div></div></div>`

export const screenFirst = () =>
  wsScreen(
    "chat",
    `<aside class="ws-panel ws-panel--empty" data-pane="hotels"><div class="state"><span class="state-ic">${icon("hotel", 40)}</span><h4>Здесь появятся отели</h4><p>Опишите в чате, какой отель нужен. Подходящие отели появятся здесь, а на карте будет видно почему.</p></div></aside>`,
    chatPanel({
      log: `${chatAgent("<p>Опишите отель словами. Я найду, где это правда, и покажу на карте почему.</p>", "enter")}<div class="chat-part chat-suggest"><span class="chat-cap">Примеры запросов</span>${chatChips([["sunset", "--hue-sunset", "закат из окна"], ["walk", "--hue-walk", "до моря пешком"], ["pets", "--hue-pets", "можно с собакой"], ["quiet", "--hue-quiet", "тихо ночью"]], false)}</div>`,
      composer: wsComposer(),
    }),
    "sf",
  )

const NF_ROUTE = "M70 236 C 112 222, 146 206, 150 176 S 168 124, 232 114 S 328 100, 372 96"
const NF_PIN = "M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"
const NF_ASK = "M9.6 9.4a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2.1-2.4 3.6"

const NF_MAP = `<svg class="m-svg" viewBox="0 0 480 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<defs><mask id="nf-reveal" maskUnits="userSpaceOnUse" x="0" y="0" width="480" height="360"><path class="nf-reveal" d="${NF_ROUTE}" pathLength="1000" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round"/></mask></defs>
<rect class="m-land" width="480" height="360"/>
<path class="m-contours" d="M-10 60 C 90 40, 200 70, 300 48 S 430 30, 490 44M-10 120 C 70 104, 170 128, 260 110 S 420 92, 490 104"/>
<path class="m-park" d="M262 150 C 300 140, 330 150, 338 176 S 312 214, 280 210 S 246 168, 262 150Z"/>
<g class="m-buildings"><rect x="22" y="40" width="44" height="30" rx="2"/><rect x="82" y="34" width="34" height="40" rx="2"/><rect x="24" y="96" width="52" height="34" rx="2"/><rect x="186" y="30" width="50" height="34" rx="2"/><rect x="250" y="40" width="40" height="28" rx="2"/><rect x="392" y="28" width="56" height="38" rx="2"/><rect x="186" y="150" width="40" height="30" rx="2"/><rect x="400" y="150" width="46" height="36" rx="2"/><rect x="88" y="128" width="30" height="34" rx="2"/></g>
<path class="m-road-casing m-major-casing" d="M-10 214 C 120 200, 300 222, 490 204"/><path class="m-road-casing" d="M152 -10 C 162 80, 140 150, 150 290M352 -10 C 344 90, 356 160, 340 280M-10 92 C 120 84, 300 104, 490 86"/>
<path class="m-road m-major" d="M-10 214 C 120 200, 300 222, 490 204"/><path class="m-road" d="M152 -10 C 162 80, 140 150, 150 290M352 -10 C 344 90, 356 160, 340 280M-10 92 C 120 84, 300 104, 490 86"/>
<path class="m-sea" d="M-10 282 C 110 262, 230 276, 330 266 S 450 252, 490 258 V370 H-10Z"/><path class="m-sand-line" d="M-10 276 C 110 256, 230 270, 330 260 S 450 246, 490 252"/><path class="m-coast" d="M-10 282 C 110 262, 230 276, 330 266 S 450 252, 490 258"/>
<path class="nf-route" d="${NF_ROUTE}" mask="url(#nf-reveal)"/>
<circle class="nf-start" cx="70" cy="236" r="6"/>
<g transform="translate(372 96)"><g class="nf-pin"><ellipse class="nf-pin-shadow" cx="0" cy="0" rx="9" ry="3"/><g transform="scale(2.6) translate(-12 -21)"><path class="nf-pin-body" d="${NF_PIN}"/><g transform="translate(12 10) scale(0.8) translate(-12 -12.6)"><path class="nf-pin-ask" d="${NF_ASK}"/><circle class="nf-pin-dot" cx="12" cy="16.9" r="0.9"/></g></g></g></g>
</svg>`

export const screen404 = () => `${wsTopFor(false)}<div class="nf-body"><div class="nf-art">${NF_MAP}</div>
<div class="nf-copy"><div class="nf-head">${MARK_SVG.replace('class="lockup-mark mk-auto"', 'class="lockup-mark mk-auto mk-unfold"')}<span class="badge badge--neutral nf-code">404</span></div>
<h4>Этого места нет на карте</h4><p>Похоже, ссылка устарела или в ней опечатка. Опишите отель в поиске, и мы покажем, где это правда.</p>
<div class="nf-actions"><button class="btn btn--primary" type="button" tabindex="-1">${icon("search")}К поиску</button><button class="btn btn--ghost" type="button" tabindex="-1">${icon("back")}Назад</button></div></div></div>`
