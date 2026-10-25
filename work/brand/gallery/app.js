import { ACCENTS, ARCH, LOGOS, NAMES } from "./catalog.js"
import { DEVICES, SYMBOLS } from "./symbols.js"

const NS = "http://www.w3.org/2000/svg"
const FAV_KEY = "brand-gallery-favs"
const ACCENT_KEY = "brand-gallery-accent"
const ONLY_KEY = "brand-gallery-only"
const nameById = Object.fromEntries(NAMES.map((n) => [n.id, n]))

const store = {
  read(key, fallback) {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? fallback : JSON.parse(raw)
    } catch {
      return fallback
    }
  },
  write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {}
  },
}

const state = {
  favs: new Set(store.read(FAV_KEY, [])),
  accent: store.read(ACCENT_KEY, "family"),
  only: store.read(ONLY_KEY, false),
}

const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "text") node.textContent = v
    else if (k === "html") node.innerHTML = v
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v)
    else node.setAttribute(k, v)
  }
  for (const c of [].concat(children)) if (c) node.append(c)
  return node
}

const symbolSvg = (key, size) => {
  const svg = document.createElementNS(NS, "svg")
  svg.setAttribute("viewBox", "0 0 64 64")
  svg.setAttribute("width", size)
  svg.setAttribute("height", size)
  svg.setAttribute("aria-hidden", "true")
  svg.innerHTML = SYMBOLS[key]
  return svg
}

const metricsCache = new Map()
const fontMetrics = (font, weight) => {
  const key = `${font}/${weight}`
  if (metricsCache.has(key)) return metricsCache.get(key)
  const ctx = document.createElement("canvas").getContext("2d")
  ctx.font = `${weight} 100px "${font}"`
  const m = {
    cap: ctx.measureText("H").actualBoundingBoxAscent,
    xh: ctx.measureText("x").actualBoundingBoxAscent,
  }
  metricsCache.set(key, m)
  return m
}

const wordText = (logo) => {
  const raw = logo.word?.text ?? nameById[logo.name].name.toLowerCase()
  return logo.upper ? raw.toUpperCase() : raw
}

const lockupSvg = (logo) => {
  const svg = document.createElementNS(NS, "svg")
  svg.classList.add("lockup")
  svg.setAttribute("role", "img")
  svg.setAttribute("aria-label", nameById[logo.name].name)
  const text = document.createElementNS(NS, "text")
  text.setAttribute("class", "t")
  text.setAttribute("font-family", `"${logo.font}"`)
  text.setAttribute("font-weight", logo.weight)
  text.setAttribute("font-size", "100")
  text.setAttribute("letter-spacing", logo.upper ? "2" : "-3")
  const hidden = new Set((logo.word?.marks ?? []).filter((m) => m.hide).map((m) => m.i))
  ;[...wordText(logo)].forEach((ch, i) => {
    const span = document.createElementNS(NS, "tspan")
    span.textContent = ch
    if (hidden.has(i)) span.setAttribute("fill-opacity", "0")
    text.append(span)
  })
  svg.append(text)
  svg.dataset.n = logo.n
  return svg
}

const layoutLockup = (svg, logo) => {
  const text = svg.querySelector("text")
  const { cap, xh } = fontMetrics(logo.font, logo.weight)
  const withSymbol = logo.arch !== "wordmark"
  const symSize = cap * (logo.arch === "symbol" ? 1.95 : 1.75)
  const gap = symSize * 0.32
  const tx = withSymbol ? symSize + gap : 0
  text.setAttribute("x", tx)
  text.setAttribute("y", 0)
  svg.querySelectorAll("g.extra").forEach((g) => g.remove())
  if (withSymbol) {
    const g = document.createElementNS(NS, "g")
    g.setAttribute("class", "extra")
    g.setAttribute("transform", `translate(0 ${-cap / 2 - symSize / 2}) scale(${symSize / 64})`)
    g.innerHTML = SYMBOLS[logo.symbol]
    svg.append(g)
  }
  for (const mark of logo.word?.marks ?? []) {
    const box = text.getExtentOfChar(mark.i)
    const cx = box.x + box.width / 2
    const g = document.createElementNS(NS, "g")
    g.setAttribute("class", "extra")
    let s
    let x
    let y
    if (mark.hide) {
      s = xh * 1.1
      x = cx - s / 2
      y = -xh / 2 - s / 2
    } else {
      s = mark.d === "sun" ? xh * 0.78 : xh * 0.8
      x = cx - s / 2
      y = -xh - s * (mark.d === "sun" ? 0.9 : 1.02)
    }
    g.setAttribute("transform", `translate(${x} ${y})`)
    g.innerHTML = DEVICES[mark.d](s).replace("DEV", mark.accent ? "a" : "b")
    svg.append(g)
  }
  const bb = svg.getBBox()
  const pad = cap * 0.04
  svg.setAttribute("viewBox", `${bb.x - pad} ${bb.y - pad} ${bb.width + pad * 2} ${bb.height + pad * 2}`)
}

const renderNames = () => {
  const grid = document.getElementById("names")
  grid.replaceChildren(
    ...NAMES.map((n) => {
      const first = LOGOS.find((l) => l.name === n.id)
      const count = LOGOS.filter((l) => l.name === n.id).length
      const dots = el("span", { class: "score", "aria-label": `Уникальность ${n.distinct} из 5` },
        [1, 2, 3, 4, 5].map((i) => el("i", { class: i <= n.distinct ? "on" : "" })))
      return el("a", { class: "name-card", href: `#name-${n.id}` }, [
        el("span", { class: "name-word", style: `font-family:"${first.font}";font-weight:${first.weight}`, text: n.name }),
        el("span", { class: "name-tag", text: n.tagline }),
        el("span", { class: "name-origin", text: n.origin }),
        el("span", { class: "name-meta" }, [dots, el("span", { text: `${count} ${count === 1 ? "знак" : count < 5 ? "знака" : "знаков"}` })]),
        el("span", { class: "name-known", text: n.known }),
      ])
    }),
  )
}

const panel = (kind, logo) => el("div", { class: `panel p-${kind}` }, [lockupSvg(logo)])

const sizesRow = (logo, kind) =>
  el("div", { class: `sizes p-${kind}` }, [72, 40, 24, 16].map((s) => el("span", { class: "size" }, [symbolSvg(logo.symbol, s), el("small", { text: `${s}` })])))

const productStrip = (logo) => {
  const n = nameById[logo.name]
  const tab = el("div", { class: "mock-tab p-light" }, [
    el("span", { class: "tab" }, [symbolSvg(logo.symbol, 16), el("span", { text: `${n.name} | ${n.tagline.replace(/\.$/, "")}` })]),
    el("span", { class: "tab ghost" }, [el("span", { text: "Сочи, отели" })]),
  ])
  const header = el("div", { class: "mock-header p-dark" }, [
    el("span", { class: "mock-logo" }, [lockupSvg(logo)]),
    el("span", { class: "mock-search", text: "тихий номер с видом на закат недалеко от моря" }),
    el("span", { class: "mock-lang", text: "RU" }),
  ])
  const og = el("div", { class: "mock-og p-light" }, [
    el("span", { class: "og-logo" }, [lockupSvg(logo)]),
    el("strong", { text: n.tagline }),
    el("span", { text: "Поиск отелей по проверяемым фактам" }),
  ])
  return el("div", { class: "product" }, [tab, header, og])
}

const favButton = (logo) => {
  const btn = el("button", {
    class: "fav",
    type: "button",
    "aria-pressed": String(state.favs.has(logo.n)),
    "aria-label": `Избранное: знак ${logo.n}`,
    html: `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.7l5.9-.9Z"/></svg>`,
    onclick: () => {
      if (state.favs.has(logo.n)) state.favs.delete(logo.n)
      else state.favs.add(logo.n)
      store.write(FAV_KEY, [...state.favs])
      btn.setAttribute("aria-pressed", String(state.favs.has(logo.n)))
      btn.closest(".logo-card").classList.toggle("is-fav", state.favs.has(logo.n))
      updateCounts()
    },
  })
  return btn
}

const logoCard = (logo) =>
  el("article", { class: `logo-card${state.favs.has(logo.n) ? " is-fav" : ""}`, id: `logo-${logo.n}` }, [
    el("header", { class: "card-head" }, [
      el("span", { class: "num", text: String(logo.n) }),
      el("span", { class: "card-title" }, [
        el("strong", { text: nameById[logo.name].name }),
        el("span", { class: "chip", text: ARCH[logo.arch] }),
        el("span", { class: "chip mono", text: logo.font }),
      ]),
      favButton(logo),
    ]),
    el("p", { class: "idea", text: logo.idea }),
    el("div", { class: "panels" }, [panel("light", logo), panel("dark", logo), panel("accent", logo)]),
    el("div", { class: "rows" }, [sizesRow(logo, "light"), sizesRow(logo, "dark"), sizesRow(logo, "mono"), sizesRow(logo, "inv")]),
    productStrip(logo),
  ])

const renderLogos = () => {
  const root = document.getElementById("logos")
  root.replaceChildren(
    ...NAMES.map((n) =>
      el("section", { class: "group", id: `name-${n.id}` }, [
        el("h2", { text: n.name }),
        el("div", { class: "cards" }, LOGOS.filter((l) => l.name === n.id).map(logoCard)),
      ]),
    ),
  )
}

const applyAccent = () => {
  const a = ACCENTS.find((x) => x.id === state.accent) ?? ACCENTS[0]
  document.documentElement.style.setProperty("--acc-dark", a.onDark)
  document.documentElement.style.setProperty("--acc-light", a.onLight)
  document.querySelectorAll(".swatch").forEach((s) => s.setAttribute("aria-checked", String(s.dataset.id === a.id)))
}

const renderControls = () => {
  const box = document.getElementById("accents")
  box.replaceChildren(
    ...ACCENTS.map((a) =>
      el("button", {
        class: "swatch",
        type: "button",
        role: "radio",
        "data-id": a.id,
        style: `--sw:${a.onDark};--sw-ink:${a.onLight}`,
        onclick: () => {
          state.accent = a.id
          store.write(ACCENT_KEY, a.id)
          applyAccent()
        },
      }, [el("i"), el("span", { text: a.label })]),
    ),
  )
  const only = document.getElementById("only")
  only.setAttribute("aria-checked", String(state.only))
  only.addEventListener("click", () => {
    state.only = !state.only
    store.write(ONLY_KEY, state.only)
    only.setAttribute("aria-checked", String(state.only))
    document.body.classList.toggle("only-favs", state.only)
  })
  document.body.classList.toggle("only-favs", state.only)
}

const updateCounts = () => {
  document.getElementById("fav-count").textContent = String(state.favs.size)
  const list = [...state.favs].sort((a, b) => a - b)
  document.getElementById("fav-list").textContent = list.length ? list.join(", ") : "пока пусто"
  document.querySelectorAll(".group").forEach((g) => g.classList.toggle("has-fav", !!g.querySelector(".is-fav")))
}

const layoutAll = () => {
  document.querySelectorAll("svg.lockup").forEach((svg) => {
    const logo = LOGOS.find((l) => String(l.n) === svg.dataset.n)
    layoutLockup(svg, logo)
  })
}

document.getElementById("total").textContent = `${NAMES.length} названий, ${LOGOS.length} знаков`
renderControls()
renderNames()
renderLogos()
applyAccent()
updateCounts()
Promise.all(LOGOS.map((l) => document.fonts.load(`${l.weight} 100px "${l.font}"`)))
  .then(() => document.fonts.ready)
  .then(() => requestAnimationFrame(layoutAll))
