import { CHARACTERISTICS, CURVES, DURATIONS, ELEVATION, HOTELS, RADII, SCALES, SEMANTIC, SPACES, STATUSES, TYPE_SCALE } from "./data.js"
import { EN, RU_EXTRA } from "./i18n.js"
import { ICON_GROUPS, icon } from "./icons.js"
import { buildMap, miniMap } from "./map.js"
import { MOTION_DEMOS } from "./motion.js"
import { initChatDemo, initChatInputs, initPlays } from "./chat.js"
import { screenDesktop, screenFirst, screenHotel, screenHotelier, screenPhone, screenPhoneList, screen404 } from "./screens.js"
import { vizCompare, vizDecay, vizElevation, vizFloors, vizMatch, vizNoise, vizSunset } from "./viz.js"

const root = document.documentElement
const $ = (s, el = document) => el.querySelector(s)
const $$ = (s, el = document) => [...el.querySelectorAll(s)]
const cssVar = (name, el = root) => getComputedStyle(el).getPropertyValue(name).trim()
const motionMs = (name) => {
  const v = cssVar(name)
  return v.endsWith("ms") ? Number.parseFloat(v) : Number.parseFloat(v) * 1000
}
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches
const store = {
  get(k) {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v)
    } catch {}
  },
}

const RU = { ...RU_EXTRA }
let lang = store.get("fm-lang") === "en" ? "en" : "ru"
const t = (key) => (lang === "en" ? EN[key] : RU[key]) ?? RU[key] ?? key

const captureRu = () => {
  $$("[data-i18n]").forEach((el) => {
    if (!(el.dataset.i18n in RU)) RU[el.dataset.i18n] = el.textContent
  })
  $$("[data-i18n-value]").forEach((el) => {
    if (!(el.dataset.i18nValue in RU)) RU[el.dataset.i18nValue] = el.value
  })
  $$("[data-i18n-placeholder]").forEach((el) => {
    if (!(el.dataset.i18nPlaceholder in RU)) RU[el.dataset.i18nPlaceholder] = el.placeholder
  })
}

const inView = (el) => {
  const r = el.getBoundingClientRect()
  return r.bottom > 0 && r.top < innerHeight && r.width > 0
}

const applyTexts = () => {
  $$("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n)
  })
  $$("[data-i18n-value]").forEach((el) => {
    el.value = t(el.dataset.i18nValue)
  })
  $$("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder)
  })
  $$("[data-tip-key]").forEach((el) => el.setAttribute("aria-label", t(el.dataset.tipKey)))
  $$(".js-select").forEach((s) => syncSelect(s))
  root.lang = lang
}

const setLang = (next, animate) => {
  if (next === lang) return
  lang = next
  store.set("fm-lang", lang)
  if (!animate || reduced() || !document.startViewTransition) {
    applyTexts()
    return
  }
  const vt = document.startViewTransition(() => applyTexts())
  vt.ready.then(() => {
    root.animate({ clipPath: ["inset(0 0 100% 0)", "inset(0 0 0 0)"] }, { duration: motionMs("--dur-reveal"), easing: cssVar("--ease-in-out"), pseudoElement: "::view-transition-new(root)" })
  })
}

const currentTheme = () => root.dataset.theme
const setTheme = (next) => {
  root.dataset.theme = next
  store.set("fm-theme", next)
  requestAnimationFrame(renderSemantic)
}

const toggleTheme = (origin, fromKeyboard) => {
  const next = currentTheme() === "dark" ? "light" : "dark"
  const freeze = () => root.classList.add("is-switching")
  const thaw = () => requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("is-switching")))
  if (!document.startViewTransition || reduced() || fromKeyboard) {
    freeze()
    setTheme(next)
    thaw()
    return
  }
  const r = origin.getBoundingClientRect()
  const x = r.left + r.width / 2
  const y = r.top + r.height / 2
  const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  const vt = document.startViewTransition(() => {
    freeze()
    setTheme(next)
  })
  vt.finished.finally(thaw)
  vt.ready.then(() => {
    root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] }, { duration: motionMs("--dur-reveal"), easing: cssVar("--ease-in-out"), pseudoElement: "::view-transition-new(root)" })
  })
}

const placeIndicator = (group, instant) => {
  const ind = $(".seg-indicator", group)
  const sel = $('[aria-checked="true"], [aria-selected="true"]', group)
  if (!ind || !sel) return
  const ir = ind.getBoundingClientRect()
  const sr = sel.getBoundingClientRect()
  if (instant) ind.style.transition = "none"
  ind.style.setProperty("--x", `${sr.left - ir.left}px`)
  ind.style.setProperty("--r", `${ir.right - sr.right}px`)
  if (instant) {
    ind.getBoundingClientRect()
    ind.style.transition = ""
  }
}

const initSegs = () => {
  $$(".js-seg").forEach((group) => {
    const attr = group.getAttribute("role") === "tablist" ? "aria-selected" : "aria-checked"
    $$("button", group).forEach((b) => {
      b.addEventListener("click", (e) => {
        $$("button", group).forEach((x) => x.setAttribute(attr, String(x === b)))
        placeIndicator(group, e.detail === 0 && false)
        if (b.dataset.lang) setLang(b.dataset.lang, e.detail !== 0)
      })
    })
    if (group.id === "lang-switch") $$("button", group).forEach((b) => b.setAttribute("aria-checked", String(b.dataset.lang === lang)))
    placeIndicator(group, true)
  })
  new ResizeObserver(() => $$(".js-seg").forEach((g) => placeIndicator(g, true))).observe(document.body)
}

const openLayer = (layer) => layer.setAttribute("data-open", "")
const closeLayer = (layer) => layer.removeAttribute("data-open")

const syncSelect = (sel) => {
  const value = sel.dataset.value
  const opt = $$(".option", sel).find((o) => o.dataset.value === value)
  $$(".option", sel).forEach((o) => o.setAttribute("aria-selected", String(o === opt)))
  if (opt) $(".select-value", sel).textContent = $("span", opt).textContent
}

const listNav = (layer, key) => {
  const opts = $$(".option", layer).filter((o) => o.offsetParent !== null)
  if (!opts.length) return null
  let i = opts.findIndex((o) => o.hasAttribute("data-active"))
  if (key === "ArrowDown") i = (i + 1) % opts.length
  if (key === "ArrowUp") i = i <= 0 ? opts.length - 1 : i - 1
  if (key === "Home") i = 0
  if (key === "End") i = opts.length - 1
  opts.forEach((o, j) => o.toggleAttribute("data-active", j === i))
  opts[i]?.scrollIntoView({ block: "nearest" })
  return opts[i]
}

const initSelects = () => {
  $$(".js-select").forEach((sel) => {
    const trigger = $(".select-trigger", sel)
    const layer = $(".layer", sel)
    syncSelect(sel)
    const close = (focus) => {
      closeLayer(layer)
      trigger.setAttribute("aria-expanded", "false")
      if (focus) trigger.focus()
    }
    const open = () => {
      openLayer(layer)
      trigger.setAttribute("aria-expanded", "true")
      $$(".option", layer).forEach((o) => o.toggleAttribute("data-active", o.getAttribute("aria-selected") === "true"))
    }
    const pick = (o) => {
      sel.dataset.value = o.dataset.value
      syncSelect(sel)
      close(true)
    }
    trigger.addEventListener("click", () => (layer.hasAttribute("data-open") ? close() : open()))
    trigger.addEventListener("keydown", (e) => {
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
        e.preventDefault()
        if (!layer.hasAttribute("data-open")) open()
        else listNav(layer, e.key)
      }
      if ((e.key === "Enter" || e.key === " ") && layer.hasAttribute("data-open")) {
        e.preventDefault()
        const a = $(".option[data-active]", layer)
        if (a) pick(a)
      }
      if (e.key === "Escape") close(true)
    })
    $$(".option", layer).forEach((o) => o.addEventListener("click", () => pick(o)))
    document.addEventListener("pointerdown", (e) => {
      if (!sel.contains(e.target)) close()
    })
  })
  $$(".js-menu").forEach((m) => {
    const trigger = $("button", m)
    const layer = $(".layer", m)
    const close = (focus) => {
      closeLayer(layer)
      trigger.setAttribute("aria-expanded", "false")
      if (focus) trigger.focus()
    }
    trigger.addEventListener("click", () => {
      if (layer.hasAttribute("data-open")) close()
      else {
        openLayer(layer)
        trigger.setAttribute("aria-expanded", "true")
      }
    })
    m.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close(true)
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key) && layer.hasAttribute("data-open")) {
        e.preventDefault()
        listNav(layer, e.key)
      }
      if (e.key === "Enter" && layer.hasAttribute("data-open")) {
        const a = $(".option[data-active]", layer)
        if (a) {
          e.preventDefault()
          a.click()
        }
      }
    })
    $$(".option", layer).forEach((o) =>
      o.addEventListener("click", () => {
        close(true)
        toast("info", $("span", o).textContent, "")
      }),
    )
    document.addEventListener("pointerdown", (e) => {
      if (!m.contains(e.target)) close()
    })
  })
}

const initCombobox = () => {
  $$(".js-combobox").forEach((c) => {
    const input = $("input", c)
    const layer = $(".layer", c)
    const open = () => {
      openLayer(layer)
      input.setAttribute("aria-expanded", "true")
    }
    const close = () => {
      closeLayer(layer)
      input.setAttribute("aria-expanded", "false")
    }
    const filter = () => {
      const q = input.value.trim().toLowerCase()
      $$(".option", layer).forEach((o) => {
        const span = $("span[data-i18n]", o)
        const text = t(span.dataset.i18n)
        const at = q ? text.toLowerCase().indexOf(q) : -1
        o.hidden = q.length > 0 && at < 0
        span.innerHTML = at >= 0 ? `${text.slice(0, at)}<mark>${text.slice(at, at + q.length)}</mark>${text.slice(at + q.length)}` : text
        o.removeAttribute("data-active")
      })
      $$(".option-group, .layer-sep", layer).forEach((g) => {
        g.hidden = q.length > 0
      })
    }
    input.addEventListener("focus", () => {
      filter()
      open()
    })
    input.addEventListener("input", () => {
      filter()
      open()
    })
    input.addEventListener("keydown", (e) => {
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
        e.preventDefault()
        open()
        listNav(layer, e.key)
      }
      if (e.key === "Enter") {
        const a = $(".option[data-active]", layer)
        if (a) {
          e.preventDefault()
          input.value = $("span", a).textContent
          close()
        }
      }
      if (e.key === "Escape") close()
    })
    $$(".option", layer).forEach((o) =>
      o.addEventListener("click", () => {
        input.value = $("span", o).textContent
        close()
        input.focus()
      }),
    )
    document.addEventListener("pointerdown", (e) => {
      if (!c.contains(e.target)) close()
    })
  })
}

let tipEl = null
let tipTimer = 0
let tipHiddenAt = 0
const showTip = (target) => {
  hideTip(true)
  const el = document.createElement("div")
  el.className = "tooltip"
  el.setAttribute("role", "tooltip")
  el.textContent = t(target.dataset.tipKey)
  if (performance.now() - tipHiddenAt < 300) el.dataset.instant = ""
  document.body.append(el)
  const r = target.getBoundingClientRect()
  const w = el.offsetWidth
  const below = r.top < 60
  el.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`
  el.style.top = below ? `${r.bottom + 8}px` : `${r.top - el.offsetHeight - 8}px`
  el.style.setProperty("--origin", below ? "top center" : "bottom center")
  tipEl = el
}
const hideTip = (silent) => {
  clearTimeout(tipTimer)
  if (tipEl) {
    tipEl.remove()
    tipEl = null
    if (!silent) tipHiddenAt = performance.now()
  }
}
const initTips = () => {
  $$("[data-tip-key]").forEach((el) => {
    el.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse") return
      clearTimeout(tipTimer)
      const quick = performance.now() - tipHiddenAt < 300
      tipTimer = setTimeout(() => showTip(el), quick ? 0 : motionMs("--delay-tooltip"))
    })
    el.addEventListener("pointerleave", () => hideTip())
    el.addEventListener("focus", () => {
      if (el.matches(":focus-visible")) showTip(el)
    })
    el.addEventListener("blur", () => hideTip())
    el.addEventListener("click", () => hideTip())
  })
}

const toast = (kind, title, text, opts = {}) => {
  const box = $("#toasts")
  const el = document.createElement("div")
  el.className = `toast toast--${kind}`
  el.setAttribute("role", kind === "danger" ? "alert" : "status")
  const ic = { success: "confirmed", danger: "rejected", info: "info", pending: "pending" }[kind]
  el.innerHTML = `${icon(ic)}<div><strong></strong>${text ? "<span></span>" : ""}</div>`
  $("strong", el).textContent = title
  if (text) $("span", el).textContent = text
  if (opts.action) {
    const b = document.createElement("button")
    b.className = "btn btn--ghost btn--compact"
    b.type = "button"
    b.textContent = opts.action
    b.addEventListener("click", () => leave())
    el.append(b)
  }
  box.append(el)
  const life = motionMs(kind === "danger" ? "--toast-life-error" : "--toast-life")
  let left = life
  let started = performance.now()
  let timer = setTimeout(() => leave(), left)
  const leave = () => {
    clearTimeout(timer)
    el.dataset.leaving = ""
    el.addEventListener("animationend", () => el.remove(), { once: true })
    setTimeout(() => el.remove(), 400)
  }
  el.addEventListener("pointerenter", () => {
    clearTimeout(timer)
    left -= performance.now() - started
  })
  el.addEventListener("pointerleave", () => {
    started = performance.now()
    timer = setTimeout(() => leave(), Math.max(800, left))
  })
}

const leaveThenRemove = (els) => {
  els.forEach((el) => {
    el.dataset.leaving = ""
    el.addEventListener("animationend", () => el.remove(), { once: true })
    setTimeout(() => el.remove(), 500)
  })
}

const modal = (kind, opener) => {
  const scrim = document.createElement("div")
  scrim.className = "scrim"
  const panel = document.createElement("div")
  panel.className = kind
  panel.setAttribute("role", "dialog")
  panel.setAttribute("aria-modal", "true")
  if (kind === "dialog") {
    panel.innerHTML = `<div class="dialog-head"><h3 tabindex="-1"></h3><button class="btn btn--ghost btn--icon btn--compact js-close" type="button">${icon("x")}</button></div><p></p><div class="dialog-actions"><button class="btn btn--ghost js-close" type="button"></button><button class="btn btn--primary js-ok" type="button"></button></div>`
    $("h3", panel).textContent = t("dialog.title")
    $("p", panel).textContent = t("dialog.text")
    $(".dialog-actions .js-close", panel).textContent = t("dialog.cancel")
    $(".js-ok", panel).textContent = t("dialog.ok")
    $(".dialog-head .js-close", panel).setAttribute("aria-label", t("dialog.cancel"))
  } else {
    panel.innerHTML = `<span class="sheet-grip"></span><div class="dialog-head"><h3 tabindex="-1" style="margin:0;font:var(--weight-bold) var(--font-size-heading)/1.2 var(--font-sans);letter-spacing:var(--tracking-heading)"></h3><button class="btn btn--ghost btn--icon btn--compact js-close" type="button">${icon("x")}</button></div><p style="margin:0;color:var(--text-secondary)"></p><div class="row"><span class="badge badge--success">${icon("confirmed")}3/3</span><span class="badge badge--fact">${icon("sunset")}${t("ch.sunset")}</span><span class="badge badge--fact">${icon("walk")}6 мин</span></div><button class="btn btn--fact btn--hero js-close" type="button">${icon("map")}${t("b.onmap")}</button>`
    $("h3", panel).textContent = t("sheet.title")
    $("p", panel).textContent = t("sheet.text")
    $(".dialog-head .js-close", panel).setAttribute("aria-label", t("dialog.cancel"))
  }
  panel.setAttribute("aria-labelledby", "")
  document.body.append(scrim, panel)
  $("h3", panel).focus()
  const close = () => {
    leaveThenRemove([scrim, panel])
    document.removeEventListener("keydown", onKey)
    opener.focus()
  }
  const onKey = (e) => {
    if (e.key === "Escape") close()
  }
  document.addEventListener("keydown", onKey)
  scrim.addEventListener("click", close)
  $$(".js-close", panel).forEach((b) => b.addEventListener("click", close))
  $(".js-ok", panel)?.addEventListener("click", () => {
    close()
    toast("success", t("toast.success"), t("toast.success.t"))
  })
}

const initOverlays = () => {
  $$(".js-toast").forEach((b) =>
    b.addEventListener("click", () => {
      const k = b.dataset.toast
      toast(k, t(`toast.${k}`), t(`toast.${k}.t`), k === "success" ? { action: t("toast.undo") } : {})
    }),
  )
  $$(".js-dialog").forEach((b) => b.addEventListener("click", () => modal("dialog", b)))
  $$(".js-sheet").forEach((b) => b.addEventListener("click", () => modal("sheet", b)))
  $$(".js-disclosure").forEach((d) => {
    const trig = $(".disclosure-trigger", d)
    const panel = $(".disclosure-panel", d)
    trig.addEventListener("click", () => {
      const open = trig.getAttribute("aria-expanded") !== "true"
      trig.setAttribute("aria-expanded", String(open))
      panel.toggleAttribute("data-open", open)
    })
  })
  $$(".js-busy").forEach((b) =>
    b.addEventListener("click", () => {
      if (b.getAttribute("aria-busy") === "true") return
      b.setAttribute("aria-busy", "true")
      $(".spinner", b).hidden = false
      setTimeout(() => {
        b.removeAttribute("aria-busy")
        $(".spinner", b).hidden = true
        toast("success", t("toast.success"), t("toast.success.t"))
      }, 1600)
    }),
  )
  $$(".js-stepper").forEach((s) => {
    const out = $("output", s)
    $$("button", s).forEach((b) =>
      b.addEventListener("click", () => {
        out.textContent = String(Math.max(1, Math.min(8, Number(out.textContent) + Number(b.dataset.step))))
      }),
    )
  })
  $$(".js-select-card").forEach((c) => {
    const toggle = () => c.setAttribute("aria-selected", String(c.getAttribute("aria-selected") !== "true"))
    c.addEventListener("click", toggle)
    c.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        toggle()
      }
    })
  })
  $$(".js-question").forEach((q) => {
    const actions = $(".question-actions", q)
    const result = $(".question-result", q)
    $$("[data-answer]", q).forEach((b) =>
      b.addEventListener("click", () => {
        const a = b.dataset.answer
        q.dataset.answered = a
        actions.hidden = true
        const badge = { yes: ["success", "confirmed"], no: ["danger", "rejected"], skip: ["neutral", "pending"] }[a]
        result.hidden = false
        result.className = "question-result row"
        result.innerHTML = `<span class="badge badge--${badge[0]}" style="animation: var(--motion-scale-in, kf-scale-in var(--dur-base) var(--ease-out) both)">${icon(badge[1])}<span data-i18n="q.done.${a}">${t(`q.done.${a}`)}</span></span><button class="btn btn--ghost btn--compact" type="button" data-i18n="q.undo">${t("q.undo")}</button>`
        $("button", result).addEventListener("click", () => {
          delete q.dataset.answered
          result.hidden = true
          actions.hidden = false
          $("button", actions).focus()
        })
        $("button", result).focus()
      }),
    )
  })
}

const copy = (text) => {
  navigator.clipboard?.writeText(text).catch(() => {})
  toast("success", t("toast.copied"), text)
}

const WHITE = { r: 255, g: 255, b: 255, a: 1 }
const INK = { r: 18, g: 20, b: 15, a: 1 }
const renderPalette = () => {
  $("#palette").innerHTML = SCALES.map(
    (s) =>
      `<div class="scale-name"><b>${s.name}</b><span class="label">${s.note}</span><code class="token">--${s.prefix}-*</code></div><div class="ramp" style="--n:${s.steps.length}">${s.steps
        .map((n) => {
          const v = `--${s.prefix}-${n}`
          const c = resolve(v)
          const rw = ratio(c, WHITE)
          const ri = ratio(c, INK)
          const onWhite = rw >= ri
          const best = Math.max(rw, ri)
          const main = s.main === n ? " is-main" : ""
          return `<button class="ramp-step${main}" type="button" data-copy="${v}" style="--c: var(${v}); --on: ${onWhite ? "#ffffff" : "#12140f"}" aria-label="${v} ${hex(c)}"><span class="ramp-aa">Aa <small>${best.toFixed(1)}</small></span><span class="ramp-n">${n}</span><span class="ramp-hex">${hex(c).toUpperCase()}</span></button>`
        })
        .join("")}</div>`,
  ).join("")
  $("#map-swatches").innerHTML = ["--map-land", "--map-water", "--map-water-line", "--map-park", "--map-sand", "--map-building", "--map-road", "--map-road-casing", "--map-rail", "--map-label", "--map-hotel-selected", "--map-fact", "--map-route", "--map-viewshed-line", "--hue-nightlife"]
    .map((v) => `<button class="swatch" type="button" data-copy="${v}" style="--c: var(${v})"><i></i><b>${v.replace("--map-", "").replace("--", "")}</b><span class="js-live" data-var="${v}"></span></button>`)
    .join("")
}

const parseColor = (str) => {
  const m = str.match(/rgba?\(([^)]+)\)/)
  if (!m) return null
  const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number.parseFloat)
  return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }
}
const probe = document.createElement("i")
const resolve = (v) => {
  if (!probe.isConnected) {
    probe.style.cssText = "position:absolute;visibility:hidden"
    document.body.append(probe)
  }
  probe.style.color = `var(${v})`
  return parseColor(getComputedStyle(probe).color)
}
const blend = (c, bg) => ({ r: c.r * c.a + bg.r * (1 - c.a), g: c.g * c.a + bg.g * (1 - c.a), b: c.b * c.a + bg.b * (1 - c.a), a: 1 })
const lum = (c) => {
  const f = (x) => {
    const s = x / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}
const hex = (c) => `#${[c.r, c.g, c.b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("")}${c.a < 1 ? Math.round(c.a * 255).toString(16).padStart(2, "0") : ""}`

function renderSemantic() {
  const base = resolve("--surface-base")
  const raised = resolve("--surface-raised")
  if (!base) return
  const rows = SEMANTIC.map((g) => {
    const head = `<tr><th colspan="5">${g.group}</th></tr>`
    const body = g.items
      .map((item) => {
        const [v, on] = Array.isArray(item) ? item : [item, null]
        const c = resolve(v)
        if (!c) return ""
        const shown = blend(c, base)
        let contrast = ""
        const badge = (r, hint) => {
          const pass = r >= 4.5
          return `<span class="badge badge--${pass ? "success" : hint ? "neutral" : "warning"}">${icon(pass ? "confirmed" : "warning")}${r.toFixed(1)}</span>`
        }
        if (g.text) {
          const r1 = ratio(blend(c, base), base)
          const r2 = ratio(blend(c, raised), raised)
          const pass = Math.min(r1, r2) >= 4.5
          const hint = v === "--text-disabled"
          contrast = `<span class="badge badge--${pass ? "success" : hint ? "neutral" : "warning"}">${icon(pass ? "confirmed" : "warning")}${r1.toFixed(1)} / ${r2.toFixed(1)}</span>`
        } else if (on) {
          const fg = resolve(on)
          contrast = `${badge(ratio(fg, blend(c, base)))}<span class="token" style="margin-left:8px">${on}</span>`
        }
        const sample = g.text ? `<span class="tok-sample" style="color: var(${v})">Тихо, закат, море</span>` : `<span class="tok-sample" style="background: var(${v}); color: var(${on ?? "--text-primary"}); box-shadow: inset 0 0 0 1px var(--border-subtle)">Аа</span>`
        return `<tr><td><span class="tok-chip" style="--c: ${hex(shown)}"></span></td><td><code class="token">${v}</code></td><td class="token">${hex(c)}</td><td>${sample}</td><td>${contrast}</td></tr>`
      })
      .join("")
    return head + body
  }).join("")
  $("#semantic-table").innerHTML = `<tr><th></th><th>Токен</th><th>Значение</th><th>Пример</th><th>Контраст: текст на странице и карточке, пара для заливок</th></tr>${rows}`
  $$(".js-live").forEach((el) => {
    const c = resolve(el.dataset.var)
    el.textContent = c ? hex(c) : ""
  })
}

const renderStatus = () => {
  $("#status-table").innerHTML = `<tr><th>Статус</th><th>Что значит</th><th>Где</th><th>Токен</th></tr>${STATUSES.map(
    (s) => `<tr><td><span class="badge badge--${s.badge}">${icon(s.icon)}<span data-i18n="st.${s.key}">${s.ru}</span></span></td><td>${s.meaning}</td><td style="color: var(--text-muted)">${s.where}</td><td><code class="token">${s.token}</code></td></tr>`,
  ).join("")}`
  $("#badges-demo").innerHTML = STATUSES.map((s) => `<span class="badge badge--${s.badge}${s.key === "pending" ? " badge--pending" : ""}">${icon(s.icon)}<span data-i18n="st.${s.key}">${s.ru}</span></span>`).join("")
}

const renderChips = () => {
  const chip = (c, pressed) => `<button class="chip js-chip" type="button" aria-pressed="${pressed}" style="--hue: var(${c.hue})"><span class="chip-dot">${icon(c.icon, 14)}</span><span data-i18n="ch.${c.key}">${c.ru}</span></button>`
  $("#chips-demo").innerHTML = CHARACTERISTICS.map((c, i) => chip(c, i < 3)).join("")
  $("#hue-chips").innerHTML = CHARACTERISTICS.map((c) => `<span class="stack" style="gap:6px">${chip(c, true)}<code class="token">${c.hue}</code></span>`).join("")
  $$(".js-chip").forEach((b) => b.addEventListener("click", () => b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true"))))
}

const renderType = () => {
  $("#type-scale").innerHTML = TYPE_SCALE.map((s) => {
    const size = `var(--font-size-${s.token})`
    const lh = `var(--line-height-${s.token})`
    const style = `font-size:${size};line-height:${lh};font-weight:var(${s.weight ?? "--weight-regular"});letter-spacing:var(${s.tracking ?? "--tracking-normal"})`
    const raw = cssVar(`--font-size-${s.token}`)
    const fluid = raw.startsWith("clamp")
    const px = (v) => `${Math.round(Number.parseFloat(v) * (v.includes("rem") ? 16 : 1))}`
    const range = fluid ? (() => {
      const parts = raw.slice(6, -1).split(",").map((x) => x.trim())
      return `${px(parts[0])}–${px(parts[2])} px, тянется`
    })() : `${px(raw)} px`
    return `<div class="type-row"><div class="token"><b style="color:var(--text-primary);font-family:var(--font-sans)">${s.token}</b><span>${range}</span><span>интерлиньяж ${cssVar(`--line-height-${s.token}`)}</span><span>${s.use ?? ""}</span></div><p class="type-sample" style="${style}">${s.sample}</p></div>`
  }).join("")
}

const renderScales = () => {
  $("#space-scale").innerHTML = SPACES.map((n) => `<div class="space-bar"><code class="token">--space-${n}</code><span class="token">${n} px</span><i style="--w:${n * 3}px"></i></div>`).join("")
  $("#radius-scale").innerHTML = RADII.map((r) => `<div class="stack" style="gap:8px"><div class="radius-sample" style="--r: var(${r.token})"><span class="radius-corner"></span><span class="token">${cssVar(r.token).replace("px", " px")}</span></div><code class="token">${r.token}</code><span class="label">${r.use}</span></div>`).join("")
  $("#elevation-scale").innerHTML = ELEVATION.map((e) => `<div class="stack" style="gap:8px"><div class="elev-sample" style="box-shadow: var(${e.token})"></div><code class="token">${e.token}</code><span class="label">${e.use}</span></div>`).join("")
}

const GROUP_NAMES = { interface: "Интерфейс", map: "Карта", characteristics: "Характеристики", provenance: "Источники", status: "Статусы" }
const renderIcons = () => {
  $("#icon-groups").innerHTML = ICON_GROUPS.map(
    (g) =>
      `<div class="scale-name"><b>${GROUP_NAMES[g.id]}</b><span class="label">${Object.keys(g.icons).length}</span></div><div class="icon-grid">${Object.keys(g.icons)
        .map((n) => `<button class="icon-cell" type="button" data-copy-text="${n}">${icon(n, 24)}<span>${n}</span></button>`)
        .join("")}</div>`,
  ).join("")
}

const renderMotionTokens = () => {
  $("#curves").innerHTML = CURVES.map((c) => {
    const [a, b, x, y] = c.bez
    const d = `M10 110 C ${10 + a * 180} ${110 - b * 100}, ${10 + x * 180} ${110 - y * 100}, 190 10`
    return `<div class="panel curve"><svg viewBox="0 0 200 120" aria-hidden="true"><line x1="10" y1="110" x2="190" y2="110"/><line x1="10" y1="10" x2="10" y2="110"/><path d="${d}"/></svg><div class="curve-track js-curve" style="--e: var(${c.token}); --d: 900ms" tabindex="0"><span class="curve-dot"></span></div><code class="token">${c.token}</code><span class="token">cubic-bezier(${c.bez.join(", ")})</span><span class="label">${c.use}</span></div>`
  }).join("")
  $$(".js-curve").forEach((tr) => {
    const run = () => {
      tr.style.setProperty("--track", `${tr.clientWidth}px`)
      tr.removeAttribute("data-run")
      tr.getBoundingClientRect()
      tr.setAttribute("data-run", "")
      setTimeout(() => tr.removeAttribute("data-run"), 1400)
    }
    tr.addEventListener("pointerenter", run)
    tr.addEventListener("click", run)
    tr.addEventListener("keydown", (e) => e.key === "Enter" && run())
  })
  const max = 900
  $("#durations").innerHTML = DURATIONS.map(([v, use]) => `<div class="dur-row"><code class="token">${v}</code><span class="token">${cssVar(v)}</span><span class="row" style="gap:12px;flex-wrap:nowrap"><i style="--w:${(motionMs(v) / max) * 68}%; min-width: 4px; flex: none"></i><span class="label">${use}</span></span></div>`).join("")
}

const renderMotion = () => {
  const grid = $("#motion-grid")
  grid.innerHTML = MOTION_DEMOS.map(
    (m, i) =>
      `<article class="motion-card"><header><b>${m.title}</b><button class="btn btn--ghost btn--icon btn--compact js-run" type="button" data-i="${i}" aria-label="Повторить">${icon("refresh", 18)}</button></header><div class="demo" data-demo="${i}">${m.html}</div><footer><span>${m.note}</span><code class="token">${m.tokens}</code></footer></article>`,
  ).join("")
  const run = (i) => {
    const el = $(`[data-demo="${i}"]`, grid)
    MOTION_DEMOS[i].run(el, { toggleTheme, setLang: (l) => setLang(l, true), lang: () => lang, motionMs })
  }
  $$(".js-run", grid).forEach((b) => b.addEventListener("click", () => run(Number(b.dataset.i))))
  MOTION_DEMOS.forEach((m, i) => m.init?.($(`[data-demo="${i}"]`, grid), { toggleTheme, setLang: (l) => setLang(l, true), lang: () => lang, motionMs }))
  const seen = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        run(Number(e.target.dataset.demo))
        seen.unobserve(e.target)
      }
    })
  }, { threshold: 0.6 })
  $$("[data-demo]", grid).forEach((d) => seen.observe(d))
}

const renderMaps = () => {
  $$("[data-map]").forEach((el, i) => {
    el.innerHTML = buildMap({ id: `m${i}`, seed: 7 })
  })
  $$("[data-mini]").forEach((el) => {
    el.innerHTML = miniMap(Number(el.dataset.mini), Number(el.dataset.mini) % 3)
  })
  const play = (frame) => {
    frame.classList.remove("is-playing")
    frame.getBoundingClientRect()
    frame.classList.add("is-playing")
  }
  const frame = $("#map-frame")
  $(".js-map-replay").addEventListener("click", () => play(frame))
  play($("#cover-stage"))
  const io = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      play(frame)
      io.disconnect()
    }
  }, { threshold: 0.4 })
  io.observe(frame)
}

const renderScrollDemo = () => {
  $("#scroll-demo").innerHTML = HOTELS.map((h, i) => `<div class="option" style="min-height:44px">${icon("hotel")}<span>${h}</span><span class="option-meta">${(i % 3) + 1}/3</span></div>`).join("")
}

const initNav = () => {
  const links = $$(".nav a")
  const ind = $(".nav-indicator")
  const set = (id) => {
    links.forEach((a) => a.setAttribute("aria-current", String(a.hash === `#${id}`)))
    const a = links.find((x) => x.hash === `#${id}`)
    if (a) ind.style.setProperty("--y", `${a.parentElement.offsetTop}px`)
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.filter((e) => e.isIntersecting).forEach((e) => set(e.target.id))
    },
    { rootMargin: "-30% 0px -65% 0px" },
  )
  $$("main > section").forEach((s) => io.observe(s))
  set("cover")
}

const initCopy = () => {
  document.addEventListener("click", (e) => {
    const s = e.target.closest("[data-copy]")
    if (s) copy(`var(${s.dataset.copy})`)
    const c = e.target.closest("[data-copy-text]")
    if (c) copy(c.dataset.copyText)
  })
}

const initReplay = () => {
  $$(".js-replay").forEach((b) =>
    b.addEventListener("click", () => {
      const target = $(b.dataset.target)
      const mark = $(".mk-unfold", target)
      const clone = mark.cloneNode(true)
      mark.replaceWith(clone)
    }),
  )
}

const initKeys = () => {
  let kb = false
  addEventListener("keydown", () => {
    kb = true
    root.dataset.inputSource = "keyboard"
  })
  addEventListener("pointerdown", () => {
    kb = false
    root.dataset.inputSource = "pointer"
  })
  $("#theme-switch").addEventListener("click", (e) => toggleTheme(e.currentTarget, e.detail === 0 && kb))
}

const BTN_VARIANTS = [
  ["Основная", "btn--primary", "Найти", "search"],
  ["Вторичная", "", "Сравнить", "compare"],
  ["Факт", "btn--fact", "На карте", "map"],
  ["Контурная", "btn--outline", "Источник", "source"],
  ["Тихая", "btn--ghost", "Поделиться", "share"],
  ["Подтвердить", "btn--confirm", "Да, есть", "confirmed"],
  ["Отклонить", "btn--danger", "Нет", "rejected"],
]
const BTN_STATES = [["Обычная", ""], ["Наведение", "is-hover"], ["Нажатие", "is-press"], ["Фокус", "is-focus"], ["Загрузка", "busy"], ["Неактивна", "disabled"]]
const renderButtonMatrix = () => {
  const head = `<tr><th>Вариант</th>${BTN_STATES.map(([n]) => `<th>${n}</th>`).join("")}</tr>`
  const rows = BTN_VARIANTS.map(([name, cls, label, ic]) => {
    const cells = BTN_STATES.map(([, st]) => {
      const busy = st === "busy"
      const dis = st === "disabled"
      const extra = busy || dis ? "" : st
      return `<td><button class="btn btn--compact ${cls} ${extra}" type="button" tabindex="-1" ${busy ? 'aria-busy="true"' : ""} ${dis ? "disabled" : ""}>${busy ? '<span class="spinner"></span>' : ""}${icon(ic, 18)}<span>${label}</span></button></td>`
    }).join("")
    return `<tr><td><b>${name}</b><br><code class="token">${cls || ".btn"}</code></td>${cells}</tr>`
  }).join("")
  $("#btn-matrix").innerHTML = head + rows
}

const renderCalendar = () => {
  const dows = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
  const cells = dows.map((d) => `<span class="cal-dow">${d}</span>`)
  for (let d = 26; d <= 31; d++) cells.push(`<span class="is-off">${d}</span>`)
  for (let d = 1; d <= 30; d++) {
    const cls = d === 25 ? "is-start" : d === 28 ? "is-end" : d > 25 && d < 28 ? "in-range" : ""
    cells.push(`<span class="${cls}">${d}</span>`)
  }
  $("#calendar").innerHTML = `<div class="cal"><div class="cal-head"><button class="btn btn--ghost btn--icon btn--compact" type="button" aria-label="Предыдущий месяц">${icon("chevron-left", 18)}</button><b>Ноябрь 2026</b><button class="btn btn--ghost btn--icon btn--compact" type="button" aria-label="Следующий месяц">${icon("chevron-right", 18)}</button></div><div class="cal-grid">${cells.join("")}</div><div class="cal-foot"><span>25–28 ноября, 3 ночи</span><button class="btn btn--ghost btn--compact" type="button">Сбросить</button></div></div>`
}

const initFormsExtra = () => {
  $$(".js-slider").forEach((w) => {
    const input = $("input", w)
    const out = $(".slider-out", w.parentElement)
    const sync = () => {
      const p = ((input.value - input.min) / (input.max - input.min)) * 100
      w.style.setProperty("--fill", `${p}%`)
      if (out) out.textContent = w.dataset.unit === "min" ? `не дальше ${input.value} мин` : `шум не выше ${input.value} из 10`
    }
    input.addEventListener("input", sync)
    sync()
  })
  const area = $("#fix-t")
  if (area) area.addEventListener("input", () => {
    $("#fix-count").textContent = String(area.value.length)
  })
  const gray = $("#grayscale")
  $("#gray-target").innerHTML = STATUSES.slice(0, 7).map((s) => `<span class="badge badge--${s.badge}">${icon(s.icon)}${s.ru}</span>`).join("")
  gray.addEventListener("change", () => $("#gray-target").classList.toggle("is-gray", gray.checked))
}

const renderFormats = () => {
  const d = new Date(2026, 9, 24, 17, 42)
  const nf = (l, o) => new Intl.NumberFormat(l, o)
  const plural = (l, n) => {
    const r = new Intl.PluralRules(l).select(n)
    if (l === "ru") return `${n} ${{ one: "отель", few: "отеля", many: "отелей", other: "отеля" }[r]}`
    return `${n} ${r === "one" ? "hotel" : "hotels"}`
  }
  const rows = [
    ["Дата", (l) => d.toLocaleDateString(l, { day: "numeric", month: "long", year: "numeric" })],
    ["Дата в данных", (l) => d.toLocaleDateString(l === "ru" ? "ru" : "en-GB")],
    ["Дата коротко", (l) => d.toLocaleDateString(l, { day: "numeric", month: "short" })],
    ["Время заката", (l) => d.toLocaleTimeString(l, { hour: "2-digit", minute: "2-digit" })],
    ["Расстояние", (l) => nf(l, { style: "unit", unit: "meter" }).format(420)],
    ["Расстояние, км", (l) => nf(l, { style: "unit", unit: "kilometer", maximumFractionDigits: 1 }).format(1.2)],
    ["Время пешком", (l) => nf(l, { style: "unit", unit: "minute" }).format(6)],
    ["Уверенность", (l) => nf(l, { minimumFractionDigits: 2 }).format(0.72)],
    ["Доля", (l) => nf(l, { style: "percent" }).format(0.72)],
    ["Цена", (l) => nf(l, { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(12400)],
    ["Количество", (l) => [1, 2, 5, 21].map((n) => plural(l, n)).join(", ")],
    ["Диапазон", () => "4–9"],
  ]
  $("#formats").innerHTML = `<tr><th>Что</th><th>RU</th><th>EN</th></tr>${rows.map(([n, fn]) => `<tr><td>${n}</td><td class="token" style="color:var(--text-primary)">${fn("ru")}</td><td class="token" style="color:var(--text-primary)">${fn("en")}</td></tr>`).join("")}`
}

const GLOSSARY = [
  ["Факт", "Проверяемое утверждение об отеле с источником, уверенностью и сроком годности.", "свойство, атрибут, фича"],
  ["Источник", "Откуда факт: отельер, расчёт, тег карты OSM. Показывается у каждого факта.", "провайдер, данные"],
  ["Уверенность", "Число от 0 до 1. Падает к концу срока годности до половины.", "точность, скор, рейтинг"],
  ["Срок годности", "Дата, до которой факт считается свежим. После него факт устарел.", "TTL, протухание"],
  ["Пожелание", "Одно условие из запроса путешественника: тихо, закат, до моря.", "фильтр, тег, параметр"],
  ["Совпадение", "Пожелание, подтверждённое фактом. Бывает полным и частичным.", "матч, релевантность"],
  ["Отельер", "Представитель отеля. Его ответ важнее расчёта.", "партнёр, владелец, админ"],
  ["Доказательство", "Объект на карте, который подтверждает факт: здание, маршрут, зона видимости.", "геообъект, слой, полигон"],
]
const MESSAGES = [
  ["error", "Не удалось загрузить отели", "Сервер не ответил за 5 секунд.", "Проверьте соединение и повторите.", "Повторить"],
  ["empty", "Таких отелей не нашли", "Условие «бары рядом» встречается реже всего.", "Уберите одно условие.", "Убрать «бары рядом»"],
  ["stale", "Данные старше полугода", "Этажность взята из OSM в марте.", "Пересчитаем по свежей карте.", "Пересчитать"],
]
const renderContent = () => {
  $("#glossary").innerHTML = GLOSSARY.map(([w, d, no]) => `<div class="panel gloss"><b>${w}</b><p>${d}</p><span class="gloss-no">Не говорим: <s>${no}</s></span></div>`).join("")
  $("#messages").innerHTML = MESSAGES.map(([k, title, why, what, btn]) => {
    const tone = k === "error" ? ["danger", "rejected"] : k === "empty" ? ["neutral", "search"] : ["warning", "stale"]
    const name = k === "error" ? "Ошибка" : k === "empty" ? "Пусто" : "Предупреждение"
    return `<div class="panel msg"><span class="badge badge--${tone[0]}" style="justify-self:start">${icon(tone[1])}${name}</span><ul class="msg-parts"><li><span>Что</span><span>${title}</span></li><li><span>Почему</span><span>${why}</span></li><li><span>Что делать</span><span>${what}</span></li><li><span>Кнопка</span><span><button class="btn btn--compact ${k === "error" ? "btn--primary" : ""}" type="button">${btn}</button></span></li></ul></div>`
  }).join("")
}

const renderTokensExport = () => {
  const src = $("#tokens-src").textContent
  const names = src.match(/--[a-z0-9-]+(?=:)/g) ?? []
  $("#tokens-count").textContent = `${new Set(names).size} токенов`
  const esc = src.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  $("#tokens-preview").innerHTML = esc.replace(/(--[a-z0-9-]+)(?=:)/g, `<span class="c-var">$1</span>`)
  const toJson = () => {
    const out = {}
    for (const m of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const sel = m[1].trim().replace(/\s+/g, " ")
      const vars = {}
      for (const v of m[2].matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) vars[v[1]] = v[2].trim().replace(/\s+/g, " ")
      if (Object.keys(vars).length) out[sel] = { ...(out[sel] ?? {}), ...vars }
    }
    return JSON.stringify(out, null, 2)
  }
  $$(".js-copy-tokens").forEach((b) =>
    b.addEventListener("click", () => {
      const text = b.dataset.format === "json" ? toJson() : src
      navigator.clipboard?.writeText(text).catch(() => {})
      toast("success", t("toast.copied"), b.dataset.format === "json" ? "tokens.json" : "tokens.css")
    }),
  )
}

const renderViz = () => {
  $("#viz-noise").innerHTML = vizNoise()
  $("#viz-elev").innerHTML = vizElevation()
  $("#viz-sunset").innerHTML = vizSunset()
  $("#viz-floors").innerHTML = vizFloors()
  $("#viz-decay").innerHTML = vizDecay()
  $("#viz-match").innerHTML = vizMatch()
  $("#viz-compare").innerHTML = vizCompare()
}

const renderScreens = () => {
  $("#scr-desktop").innerHTML = screenDesktop()
  $("#scr-hotel").innerHTML = screenHotel()
  $("#scr-phone").innerHTML = screenPhone()
  $("#scr-phone-list").innerHTML = screenPhoneList()
  $("#scr-hotelier").innerHTML = screenHotelier()
  $("#scr-first").innerHTML = screenFirst()
  $("#scr-404").innerHTML = screen404()
}

captureRu()
renderPalette()
renderStatus()
renderChips()
renderType()
renderScales()
renderIcons()
renderMotionTokens()
renderMotion()
renderMaps()
renderScrollDemo()
renderButtonMatrix()
renderCalendar()
renderFormats()
renderContent()
renderTokensExport()
renderViz()
renderScreens()
initFormsExtra()
captureRu()
applyTexts()
initSegs()
initSelects()
initCombobox()
initTips()
initOverlays()
initNav()
initCopy()
initReplay()
initKeys()
initChatInputs()
initChatDemo({ t, reduced, motionMs })
initPlays()
requestAnimationFrame(renderSemantic)
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  if (!store.get("fm-theme")) {
    root.dataset.theme = e.matches ? "dark" : "light"
    renderSemantic()
  }
})
