import { icon } from "./icons.js"

const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim()
const ms = (n) => {
  const v = css(n)
  return v.endsWith("ms") ? Number.parseFloat(v) : Number.parseFloat(v) * 1000
}
const q = (s, el) => el.querySelector(s)
const qa = (s, el) => [...el.querySelectorAll(s)]
const enterScale = [{ opacity: 0, transform: "scale(0.95)" }, { opacity: 1, transform: "none" }]
const exitScale = [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.95)" }]
const anchorIn = [{ opacity: 0, transform: "translateY(-4px) scale(0.95)" }, { opacity: 1, transform: "none" }]
const anchorOut = [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-4px) scale(0.95)" }]
const wait = (t) => new Promise((r) => setTimeout(r, t))
const play = (el, frames, dur, ease = "--ease-out", extra = {}) => el.animate(frames, { duration: ms(dur), easing: css(ease), fill: "both", ...extra })

const miniHotel = `<div class="hotel" style="width:100%;max-width:260px;grid-template-columns:44px 1fr;padding:10px;gap:10px;cursor:default"><div class="skeleton" style="aspect-ratio:1;animation:none;background:var(--surface-highlight)"></div><div class="stack" style="gap:6px"><b style="font-size:13px">Отель «Чайка»</b><span class="badge badge--success" style="justify-self:start">${icon("confirmed")}3/3</span></div></div>`

export const MOTION_DEMOS = [
  {
    title: "Нажатие",
    note: "Кнопка сжимается до 0,97, поверхность до 0,99. Кнопка в ожидании не сжимается и не меняет ширину.",
    tokens: "--press-scale --dur-press",
    html: `<button class="btn btn--primary btn--hero" type="button">${icon("search")}Найти</button>`,
    run: (el) => play(q(".btn", el), [{ scale: 1 }, { scale: 0.97 }, { scale: 1 }], "--dur-slow"),
  },
  {
    title: "Всплывающий список",
    note: "Масштаб 0,95 и сдвиг 4 px от якоря, точка роста у якоря. Закрытие быстрее открытия.",
    tokens: "--dur-base --dur-exit --shift-anchor",
    html: `<div style="position:relative;display:grid;gap:4px;justify-items:start"><span class="select-trigger" style="width:200px;box-shadow:inset 0 0 0 2px var(--focus-ring)">Сортировка${icon("chevron-down", 18, "chev")}</span><div class="layer" data-open style="position:relative;min-width:200px;transform-origin:top left">${["По совпадению", "Ближе к морю", "Тише"].map((x, i) => `<div class="option" ${i === 0 ? 'aria-selected="true"' : ""}>${x}${icon("check", 18, "option-check")}</div>`).join("")}</div></div>`,
    run: async (el) => {
      const l = q(".layer", el)
      await play(l, anchorOut, "--dur-exit").finished
      await wait(260)
      play(l, anchorIn, "--dur-base")
    },
  },
  {
    title: "Первая загрузка",
    note: "Карточки поднимаются на 6 px с задержкой 40 мс каждая. Только при первом показе, не при пагинации.",
    tokens: "--stagger --shift-rise --dur-slow",
    html: `<div class="stack" style="width:100%;gap:6px">${[0, 1, 2, 3].map(() => `<div class="hotel" style="grid-template-columns:32px 1fr;padding:8px;gap:10px;cursor:default"><div class="skeleton" style="aspect-ratio:1;animation:none"></div><div class="stack" style="gap:6px"><div class="skeleton" style="height:10px;width:60%;animation:none"></div><div class="skeleton" style="height:8px;width:40%;animation:none"></div></div></div>`).join("")}</div>`,
    run: (el) =>
      qa(".hotel", el).forEach((c, i) =>
        play(c, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], "--dur-slow", "--ease-out", { delay: i * ms("--stagger") }),
      ),
  },
  {
    title: "Смена содержимого",
    note: "Старое уходит вверх с размытием 2 px, новое приходит снизу. Для текста и чисел, которые меняются редко.",
    tokens: "--dur-fast-exit --dur-fast --blur-soft",
    html: `<div class="stat" style="text-align:center"><b class="swap-v" style="font-size:40px">24 отеля</b><span>совпадают с запросом</span></div>`,
    run: async (el) => {
      const v = q(".swap-v", el)
      await play(v, [{ opacity: 1, transform: "none", filter: "none" }, { opacity: 0, transform: "translateY(-4px)", filter: "blur(2px)" }], "--dur-fast-exit").finished
      v.textContent = v.textContent === "24 отеля" ? "7 отелей" : "24 отеля"
      play(v, [{ opacity: 0, transform: "translateY(4px)", filter: "blur(2px)" }, { opacity: 1, transform: "none", filter: "none" }], "--dur-fast")
    },
  },
  {
    title: "Раскрытие",
    note: "Панель открывается через clip-path и прозрачность. Повторный клик разворачивает анимацию с текущего кадра.",
    tokens: "--dur-panel clip-path",
    html: `<div class="disclosure" style="width:100%"><button class="disclosure-trigger" type="button" aria-expanded="false">${icon("computed")}Как посчитано${icon("chevron-down", 18, "chev")}</button><div class="disclosure-panel"><div class="disclosure-body">Азимут заката, рельеф, высоты соседних домов.</div></div></div>`,
    init: (el) => {
      const b = q("button", el)
      b.addEventListener("click", () => {
        const open = b.getAttribute("aria-expanded") !== "true"
        b.setAttribute("aria-expanded", String(open))
        q(".disclosure-panel", el).toggleAttribute("data-open", open)
      })
    },
    run: async (el) => {
      const b = q("button", el)
      if (b.getAttribute("aria-expanded") === "true") {
        b.click()
        await wait(320)
      }
      b.click()
    },
  },
  {
    title: "Диалог",
    note: "Подложка проявляется, окно растёт из 0,95. Фокус на заголовок, закрытие быстрее.",
    tokens: "--dur-base --dur-exit --enter-scale",
    html: `<div class="m-scrim" style="position:absolute;inset:0;background:var(--surface-scrim)"></div><div class="m-dialog" style="position:relative;display:grid;gap:10px;width:220px;padding:16px;border-radius:var(--radius-lg);background:var(--surface-overlay);box-shadow:var(--shadow-overlay)"><b>Отправить исправление?</b><div class="row" style="justify-content:flex-end;gap:6px"><span class="btn btn--ghost btn--compact">Отмена</span><span class="btn btn--primary btn--compact">Отправить</span></div></div>`,
    run: async (el) => {
      const s = q(".m-scrim", el)
      const d = q(".m-dialog", el)
      play(s, [{ opacity: 1 }, { opacity: 0 }], "--dur-exit")
      await play(d, exitScale, "--dur-exit").finished
      await wait(240)
      play(s, [{ opacity: 0 }, { opacity: 1 }], "--dur-base")
      play(d, enterScale, "--dur-base")
    },
  },
  {
    title: "Нижний лист",
    note: "Карточка отеля на телефоне. Выезжает по кривой шторки, уходит быстрее и тем же путём.",
    tokens: "--ease-drawer --dur-slow --dur-panel-exit",
    html: `<div class="m-sheet" style="position:absolute;left:12px;right:12px;bottom:0;display:grid;gap:10px;padding:10px 14px 16px;border-radius:var(--radius-xl) var(--radius-xl) 0 0;background:var(--surface-overlay);box-shadow:var(--shadow-overlay)"><span class="sheet-grip"></span><b>Отель «Чайка»</b><span class="badge badge--success" style="justify-self:start">${icon("confirmed")}3/3</span></div>`,
    run: async (el) => {
      const s = q(".m-sheet", el)
      await play(s, [{ transform: "none" }, { transform: "translateY(110%)" }], "--dur-panel-exit", "--ease-drawer").finished
      await wait(200)
      play(s, [{ transform: "translateY(110%)" }, { transform: "none" }], "--dur-slow", "--ease-drawer")
    },
  },
  {
    title: "Тост",
    note: "Выезжает сбоку на 24 px, уходит быстрее. Ошибка живёт 10 секунд, остальные 5, наведение ставит паузу.",
    tokens: "--shift-toast --dur-panel --toast-life",
    html: `<div class="toast toast--success" style="position:relative;width:260px;animation:none">${icon("confirmed")}<div><strong>Ответ сохранён</strong><span>Факт обновится за минуту</span></div></div>`,
    run: async (el) => {
      const t = q(".toast", el)
      await play(t, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateX(24px)" }], "--dur-exit").finished
      await wait(240)
      play(t, [{ opacity: 0, transform: "translateX(24px) scale(0.95)" }, { opacity: 1, transform: "none" }], "--dur-panel")
    },
  },
  {
    title: "Скелетон и контент",
    note: "Скелетон появляется через 200 мс, держится не меньше 300 мс, контент сменяет его прозрачностью.",
    tokens: "--delay-skeleton --hold-skeleton --motion-shimmer",
    html: `<div class="m-skel" style="width:100%;max-width:260px"><div class="hotel" style="grid-template-columns:44px 1fr;padding:10px;gap:10px;cursor:default"><div class="skeleton" style="aspect-ratio:1"></div><div class="stack" style="gap:6px"><div class="skeleton" style="height:12px;width:70%"></div><div class="skeleton" style="height:10px;width:40%"></div></div></div></div><div class="m-real" style="position:absolute;width:calc(100% - 48px);max-width:260px;opacity:0">${miniHotel}</div>`,
    run: async (el) => {
      const s = q(".m-skel", el)
      const r = q(".m-real", el)
      r.style.opacity = 0
      s.style.opacity = 0
      await wait(ms("--delay-skeleton"))
      s.style.opacity = 1
      await wait(ms("--hold-skeleton") + 600)
      play(s, [{ opacity: 1 }, { opacity: 0 }], "--dur-fast-exit")
      play(r, [{ opacity: 0 }, { opacity: 1 }], "--dur-base")
    },
  },
  {
    title: "Отложенный спиннер",
    note: "Если ответ пришёл быстрее 400 мс, спиннера не будет вовсе. Иначе он появляется и ждёт результата.",
    tokens: "--delay-spinner --dur-spin",
    html: `<div class="stack" style="justify-items:center;gap:12px"><span class="spinner m-spin" style="width:28px;height:28px;color:var(--text-accent);opacity:0"></span><span class="label m-msg">Считаем вид на закат</span></div>`,
    run: async (el) => {
      const sp = q(".m-spin", el)
      const m = q(".m-msg", el)
      m.textContent = "Считаем вид на закат"
      sp.style.opacity = 0
      await wait(ms("--delay-spinner"))
      play(sp, [{ opacity: 0 }, { opacity: 1 }], "--dur-base")
      await wait(1400)
      play(sp, [{ opacity: 1 }, { opacity: 0 }], "--dur-exit")
      m.textContent = "Закат виден с 4-го этажа"
      play(m, [{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], "--dur-fast")
    },
  },
  {
    title: "Скользящий индикатор",
    note: "Подложка переезжает к выбранному пункту через clip-path, ширину не анимируем.",
    tokens: "--dur-panel --ease-out",
    html: `<div class="segmented js-seg-demo" role="radiogroup"><span class="seg-indicator"></span><button type="button" role="radio" aria-checked="true">${icon("list", 18)}Список</button><button type="button" role="radio" aria-checked="false">${icon("map", 18)}Карта</button><button type="button" role="radio" aria-checked="false">${icon("compare", 18)}Сравнение</button></div>`,
    init: (el) => {
      const g = q(".segmented", el)
      const place = () => {
        const ind = q(".seg-indicator", g)
        const sel = q('[aria-checked="true"]', g)
        const ir = ind.getBoundingClientRect()
        const sr = sel.getBoundingClientRect()
        ind.style.setProperty("--x", `${sr.left - ir.left}px`)
        ind.style.setProperty("--r", `${ir.right - sr.right}px`)
      }
      qa("button", g).forEach((b) =>
        b.addEventListener("click", () => {
          qa("button", g).forEach((x) => x.setAttribute("aria-checked", String(x === b)))
          place()
        }),
      )
      requestAnimationFrame(place)
      g.place = place
    },
    run: async (el) => {
      const bs = qa("button", el)
      for (const i of [1, 2, 0]) {
        bs[i].click()
        await wait(520)
      }
    },
  },
  {
    title: "Чекбокс и переключатель",
    note: "Галочка рисуется через stroke-dashoffset, ползунок едет через transform, точка радио растёт из 0,4.",
    tokens: "--dur-base --dur-fast",
    html: `<div class="stack"><label class="check"><input type="checkbox"><span class="check-box"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></span>Только подтверждённые</label><label class="switch"><input type="checkbox"><span class="switch-track"><span class="switch-thumb"></span></span>Слои фактов</label><label class="radio"><input type="radio" name="m-r"><span class="radio-dot"></span>Пешком</label></div>`,
    run: async (el) => {
      const [c, s, r] = qa("input", el)
      c.checked = false
      s.checked = false
      r.checked = false
      await wait(260)
      c.checked = true
      await wait(200)
      s.checked = true
      await wait(200)
      r.checked = true
    },
  },
  {
    title: "Отрисовка маршрута",
    note: "Пеший путь до моря рисуется от отеля к пляжу. Редкое событие, поэтому длиннее обычного.",
    tokens: "--dur-draw --ease-in-out",
    html: `<svg viewBox="0 0 260 140" width="100%" height="150" aria-hidden="true"><rect width="260" height="140" rx="12" fill="var(--map-land)"/><path d="M0 112 Q 130 92 260 104 V140 H0Z" fill="var(--map-water)"/><path class="m-d" d="M70 26 H150 V70 H120 V100" fill="none" stroke="var(--map-route)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" pathLength="1000" stroke-dasharray="1000"/><rect x="58" y="16" width="24" height="18" rx="2" fill="var(--map-fact)" stroke="var(--map-fact-line)" stroke-width="2"/><circle cx="120" cy="101" r="6" fill="var(--map-route)"/></svg>`,
    run: (el) => play(q(".m-d", el), [{ strokeDashoffset: 1000 }, { strokeDashoffset: 0 }], "--dur-draw", "--ease-in-out"),
  },
  {
    title: "Появление меток",
    note: "Метки отелей падают на карту на 6 px с задержкой 40 мс, при первом ответе поиска.",
    tokens: "--stagger --dur-slow --shift-rise",
    html: `<div style="position:absolute;inset:0;background:var(--map-land)"></div><div class="row" style="position:relative;gap:14px"><span class="pin"><span class="pin-dot">${icon("check", 12)}</span>3/3</span><span class="pin" data-state="selected"><span class="pin-dot">${icon("check", 12)}</span>3/3</span><span class="pin"><span class="pin-dot">${icon("check", 12)}</span>2/3</span><span class="pin" data-state="cluster">12</span></div>`,
    run: (el) =>
      qa(".pin", el).forEach((p, i) =>
        play(p, [{ opacity: 0, transform: "translateY(-6px) scale(0.95)" }, { opacity: 1, transform: "none" }], "--dur-slow", "--ease-out", { delay: i * ms("--stagger") * 2 }),
      ),
  },
  {
    title: "Зона заката",
    note: "Сектор видимости раскрывается кругом от фасада, затем проявляется линия на солнце.",
    tokens: "--dur-draw clip-path",
    html: `<svg viewBox="0 0 260 140" width="100%" height="150" aria-hidden="true"><rect width="260" height="140" rx="12" fill="var(--map-land)"/><path d="M0 70 Q 130 96 260 60 V140 H0Z" fill="var(--map-water)"/><defs><pattern id="mv-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><line x1="0" y1="0" x2="0" y2="8" stroke="var(--map-viewshed-line)" stroke-width="1.5" opacity="0.5"/></pattern></defs><path class="m-v" d="M196 40 L0 96 L0 140 L70 140 Z" fill="url(#mv-hatch)" stroke="var(--map-viewshed-line)" stroke-width="1.25" stroke-dasharray="2 5"/><rect x="186" y="30" width="22" height="16" rx="2" fill="var(--map-fact)" stroke="var(--map-fact-line)" stroke-width="2"/><circle class="m-s" cx="22" cy="122" r="9" fill="var(--hue-sunset)"/></svg>`,
    run: async (el) => {
      const v = q(".m-v", el)
      const s = q(".m-s", el)
      s.style.opacity = 0
      await play(v, [{ clipPath: "circle(0% at 75% 28%)" }, { clipPath: "circle(120% at 75% 28%)" }], "--dur-draw").finished
      play(s, [{ opacity: 0 }, { opacity: 1 }], "--dur-slow")
      s.style.opacity = 1
    },
  },
  {
    title: "Пинг факта",
    note: "Когда факт найден, вокруг здания дважды расходится лаймовое кольцо. Только при первом появлении.",
    tokens: "kf-fact-ping 900ms",
    html: `<svg viewBox="0 0 260 140" width="100%" height="150" aria-hidden="true" style="overflow:visible"><rect width="260" height="140" rx="12" fill="var(--map-land)"/><g fill="var(--map-building)" stroke="var(--map-building-line)"><rect x="40" y="40" width="30" height="22"/><rect x="190" y="70" width="34" height="26"/><rect x="80" y="90" width="26" height="20"/></g><circle class="m-p" cx="130" cy="66" r="22" fill="none" stroke="var(--map-fact-line)" stroke-width="2" style="transform-box:fill-box;transform-origin:center"/><rect x="114" y="54" width="32" height="24" rx="2" fill="var(--map-fact)" stroke="var(--map-fact-line)" stroke-width="2"/></svg>`,
    run: (el) => play(q(".m-p", el), [{ opacity: 0.8, transform: "scale(1)" }, { opacity: 0, transform: "scale(2.4)" }], "--dur-draw", "--ease-out", { iterations: 2, fill: "none" }),
  },
  {
    title: "Сложение карты",
    note: "Фирменный загрузчик. Крайние полосы раскрываются от складки, средняя проявляется последней.",
    tokens: "--ease-fold --dur-breathe",
    html: `<span class="fold" role="img" aria-label="Загрузка" style="width:96px;height:84px"><svg viewBox="0 0 64 64"><path class="mk-ghost" d="M5 14 22 8v42L5 56Z"/><path class="mk-ghost" d="M25 8l14 6v42l-14-6Z"/><path class="mk-ghost" d="M42 14 59 8v42l-17 6Z"/><path class="mk-side f-l" d="M5 14 22 8v42L5 56Z"/><path class="mk-mid f-m" d="M25 8l14 6v42l-14-6Z"/><path class="mk-side f-r" d="M42 14 59 8v42l-17 6Z"/></svg></span>`,
    run: (el) => {
      const f = q(".fold", el)
      const c = f.cloneNode(true)
      f.replaceWith(c)
    },
  },
  {
    title: "Смена темы",
    note: "Новая тема раскрывается кругом от переключателя через View Transitions. С клавиатуры и при уменьшенном движении без анимации.",
    tokens: "--dur-reveal --ease-in-out",
    html: `<div class="m-th" style="position:relative;width:100%;max-width:280px;height:120px;border-radius:var(--radius-lg);overflow:hidden"><div style="position:absolute;inset:0;display:grid;place-items:center;background:#f4f5f1;color:#12140f;font-weight:800">Светлая</div><div class="m-th-dark" style="position:absolute;inset:0;display:grid;place-items:center;background:#12140f;color:#eef0ea;font-weight:800">Тёмная</div></div><button class="btn btn--outline btn--compact m-try" type="button">${icon("moon", 18)}Попробовать на странице</button>`,
    init: (el, ctx) => q(".m-try", el).addEventListener("click", (e) => ctx.toggleTheme(e.currentTarget, e.detail === 0)),
    run: async (el) => {
      const d = q(".m-th-dark", el)
      await play(d, [{ clipPath: "circle(0% at 88% 12%)" }, { clipPath: "circle(150% at 88% 12%)" }], "--dur-reveal", "--ease-in-out").finished
      await wait(600)
      await play(d, [{ clipPath: "circle(150% at 88% 12%)" }, { clipPath: "circle(0% at 88% 12%)" }], "--dur-reveal", "--ease-in-out").finished
    },
  },
  {
    title: "Смена языка",
    note: "Новый язык проходит волной сверху вниз через View Transitions. Где текст не изменился, волны не видно, поэтому глаз видит только сменяющиеся слова. Перестройка строк прячется под волной.",
    tokens: "--dur-reveal --ease-in-out",
    html: `<div class="m-lg" style="position:relative;width:100%;max-width:280px;height:120px;border-radius:var(--radius-lg);overflow:hidden;background:var(--surface-raised);box-shadow:var(--shadow-ring)"><div class="m-lg-a" style="position:absolute;inset:0;display:grid;align-content:center;gap:6px;padding:16px"><b style="font-size:18px;letter-spacing:-0.02em">Ищите словами.</b><span class="label">Тихо, закат, до моря пешком</span></div><div class="m-lg-b" style="position:absolute;inset:0;display:grid;align-content:center;gap:6px;padding:16px;background:var(--surface-raised);clip-path:inset(0 0 100% 0)"><b style="font-size:18px;letter-spacing:-0.02em">Search in words.</b><span class="label">Quiet, sunset, walk to the sea</span></div></div><button class="btn btn--outline btn--compact m-try" type="button">${icon("globe", 18)}Попробовать на странице</button>`,
    init: (el, ctx) => q(".m-try", el).addEventListener("click", () => ctx.setLang(ctx.lang() === "ru" ? "en" : "ru")),
    run: async (el) => {
      const b = q(".m-lg-b", el)
      await play(b, [{ clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0 0)" }], "--dur-reveal", "--ease-in-out").finished
      await wait(700)
      await play(b, [{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(100% 0 0 0)" }], "--dur-reveal", "--ease-in-out").finished
    },
  },
  {
    title: "Подсказка",
    note: "Появляется через 500 мс наведения, растёт из 0,95. Следующая подсказка в течение 300 мс появляется сразу, без анимации.",
    tokens: "--delay-tooltip --dur-fast",
    html: `<div class="stack" style="justify-items:center;gap:8px"><span class="tooltip m-tip" style="position:relative;animation:none">Где я<kbd>L</kbd></span><span class="map-ctrl"><button type="button" aria-label="Где я">${icon("locate")}</button></span></div>`,
    run: async (el) => {
      const t = q(".m-tip", el)
      await play(t, [{ opacity: 1 }, { opacity: 0 }], "--dur-fast-exit").finished
      await wait(ms("--delay-tooltip"))
      play(t, [{ opacity: 0, transform: "scale(0.95)" }, { opacity: 1, transform: "none" }], "--dur-fast")
    },
  },
]
