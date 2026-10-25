import { icon } from "./icons.js"

const CHAT_PANELS = `<path class="mk-side mk-l" d="M5 14 22 8v42L5 56Z"/><path class="mk-mid" d="M25 8l14 6v42l-14-6Z"/><path class="mk-side mk-r" d="M42 14 59 8v42l-17 6Z"/>`
const CHAT_MARK = `<svg class="mk-auto" viewBox="0 0 64 64" width="20" height="20" aria-hidden="true">${CHAT_PANELS}</svg>`
const CHAT_MARK_ENTER = `<svg class="mk-auto mk-unfold" viewBox="0 0 64 64" width="20" height="20" aria-hidden="true">${CHAT_PANELS}</svg>`
const CHAT_FOLD = `<span class="fold" role="img" aria-label="Загрузка"><svg viewBox="0 0 64 64"><path class="mk-ghost" d="M5 14 22 8v42L5 56Z"/><path class="mk-ghost" d="M25 8l14 6v42l-14-6Z"/><path class="mk-ghost" d="M42 14 59 8v42l-17 6Z"/><path class="mk-side f-l" d="M5 14 22 8v42L5 56Z"/><path class="mk-mid f-m" d="M25 8l14 6v42l-14-6Z"/><path class="mk-side f-r" d="M42 14 59 8v42l-17 6Z"/></svg></span>`

export const chatAvatar = (state = "still") => `<span class="chat-avatar">${state === "loading" ? CHAT_FOLD : state === "enter" ? CHAT_MARK_ENTER : CHAT_MARK}</span>`

export const chatUser = (text, attrs = "") => `<div class="chat-msg chat-msg--user"><p class="chat-user"${attrs}>${text}</p></div>`

export const chatAgent = (body, state = "still", cls = "") => `<div class="chat-msg chat-msg--agent">${chatAvatar(state)}<div class="chat-bubble ${cls}">${body}</div></div>`

export const chatChips = (items, pressed, live = false) =>
  `<div class="chat-chips">${items
    .map(([ic, hue, label, key]) => `<button class="chip chip--compact" type="button"${live ? "" : ' tabindex="-1"'} aria-pressed="${pressed}" style="--hue: var(${hue})"${key && live && !pressed ? ` data-send="${key}"` : ""}><span class="chip-dot">${icon(ic, 12)}</span><span${key ? ` data-i18n="${key}"` : ""}>${label}</span></button>`)
    .join("")}</div>`

export const chatThinking = (label) => chatAgent(`<span class="chat-cap">${label}</span><span class="chat-skel"><i class="skeleton"></i><i class="skeleton"></i><i class="skeleton"></i></span>`, "loading", "chat-bubble--thinking")

export const chatComposer = ({ value = "", placeholder = "", hint = "", disabled = !value, mock = true } = {}) =>
  `<div class="chat-composer"><div class="hero-search chat-input"><textarea rows="1" aria-label="Сообщение для подбора"${mock ? ' tabindex="-1" readonly' : ""} placeholder="${placeholder}">${value}</textarea><button class="btn btn--primary btn--icon btn--compact" type="button"${mock ? ' tabindex="-1"' : ""}${disabled ? " disabled" : ""} aria-label="Отправить">${icon("arrow-up", 18)}</button></div>${hint ? `<p class="chat-hint">${hint}</p>` : ""}</div>`

export const chatPanel = ({ title = "Подбор", log = "", composer = "", head = true, cls = "" } = {}) =>
  `<section class="chat ${cls}" data-pane="chat">${head ? `<header class="chat-head"><h4>${title}</h4><button class="btn btn--ghost btn--icon btn--compact" type="button" tabindex="-1" aria-label="Новый поиск">${icon("plus", 18)}</button></header>` : ""}<div class="chat-log scroll-area">${log}</div>${composer}</section>`

const CHAT_SUGGEST = [
  ["sunset", "--hue-sunset", "закат из окна", "chat.s.sunset"],
  ["walk", "--hue-walk", "до моря пешком", "chat.s.walk"],
  ["pets", "--hue-pets", "можно с собакой", "chat.s.pets"],
  ["quiet", "--hue-quiet", "тихо ночью", "chat.s.quiet"],
]

const CHAT_INTENTS = [
  { re: /тих|quiet|silen/, chip: ["quiet", "--hue-quiet", "Тихо", "ch.quiet"] },
  { re: /закат|sunset/, chip: ["sunset", "--hue-sunset", "Закат из окна", "ch.sunset"] },
  { re: /мор|пляж|sea|beach|walk/, chip: ["walk", "--hue-walk", "До моря пешком", "ch.walk"] },
  { re: /собак|живот|dog|pet/, chip: ["pets", "--hue-pets", "Животные", "ch.pets"] },
]

export const initChatDemo = ({ t, reduced, motionMs }) => {
  const root = document.getElementById("chat-demo")
  if (!root) return
  const log = root.querySelector(".js-chat-log")
  const form = root.querySelector(".js-chat-form")
  const ta = form.querySelector("textarea")
  const send = form.querySelector("button[type=submit]")
  const spin = send.querySelector(".spinner")
  const tx = (key) => `<span data-i18n="${key}">${t(key)}</span>`
  let timers = []
  let busy = false
  let intents = []

  const later = (fn, ms) => timers.push(setTimeout(fn, ms))
  const node = (html) => {
    const tpl = document.createElement("template")
    tpl.innerHTML = html
    return tpl.content.firstElementChild
  }
  const scroll = (instant) => log.scrollTo({ top: log.scrollHeight, behavior: instant || reduced() ? "auto" : "smooth" })
  const setBusy = (b) => {
    busy = b
    spin.hidden = !b
    if (b) send.setAttribute("aria-busy", "true")
    else send.removeAttribute("aria-busy")
    send.disabled = !b && !ta.value.trim()
  }
  const suggestions = () => `<div class="chat-part chat-suggest"><span class="chat-cap" data-i18n="chat.suggestions">${t("chat.suggestions")}</span>${chatChips(CHAT_SUGGEST.map(([ic, hue, , key]) => [ic, hue, t(key), key]), false, true)}</div>`
  const greet = (enter) => {
    log.innerHTML = chatAgent(`<p>${tx("chat.greeting")}</p>`, enter ? "enter" : "still") + suggestions()
  }
  const reset = (enter) => {
    timers.forEach(clearTimeout)
    timers = []
    intents = []
    greet(enter)
    setBusy(false)
  }

  const answer = (text) => {
    const found = CHAT_INTENTS.filter((i) => i.re.test(text.toLowerCase()) && !intents.includes(i))
    intents = [...intents, ...found]
    if (!intents.length) {
      return `<p class="chat-lead">${tx("chat.clarify")}</p><div class="banner" style="--b-bg: var(--status-warning-surface); --b-ic: var(--status-warning);">${icon("warning")}<div><strong>${tx("chat.clarify.none")}</strong><p>${tx("chat.clarify.none.p")}</p></div></div>${chatChips(CHAT_SUGGEST.map(([ic, hue, , key]) => [ic, hue, t(key), key]), false, true)}`
    }
    const lead = intents.length === 1 ? "chat.found.1" : intents.length < 4 ? "chat.found" : "chat.found.3"
    const pending = intents.some((i) => i.chip[0] === "pets") ? `<span class="badge badge--info badge--pending">${icon("pending")}${tx("chat.pending")}</span>` : ""
    const unmatched = /зоопарк|zoo/.test(text.toLowerCase()) ? `<span class="badge badge--warning">${icon("unknown")}${tx("chat.unmatched")}</span>` : ""
    return `<p class="chat-lead">${tx(lead)}</p><div class="chat-part"><span class="chat-cap">${tx("chat.understood")}</span>${chatChips(intents.map((i) => [i.chip[0], i.chip[1], t(i.chip[3]), i.chip[3]]), true, true)}</div>${unmatched}${pending}<div class="chat-actions"><button class="btn btn--fact btn--compact" type="button">${icon("map", 18)}${tx("b.onmap")}</button></div>`
  }

  const submit = (raw, instant, key) => {
    const text = raw.trim()
    if (!text || busy) return
    log.querySelectorAll(".chat-suggest").forEach((s) => s.remove())
    const user = node(chatUser(""))
    const p = user.querySelector(".chat-user")
    p.textContent = text
    if (key) p.dataset.i18n = key
    user.classList.add("chat-in")
    log.append(user)
    scroll(instant)
    ta.value = ""
    grow(ta)
    setBusy(true)
    let thinking = null
    const delay = motionMs("--delay-skeleton")
    later(() => {
      thinking = node(chatThinking(tx("chat.thinking")))
      thinking.classList.add("chat-in")
      log.append(thinking)
      scroll(instant)
    }, delay)
    later(() => {
      const bubble = thinking.querySelector(".chat-bubble")
      bubble.classList.add("chat-swap-out")
      later(() => {
        log.querySelectorAll(".chat-bubble[data-result] .chat-actions").forEach((a) => {
          if (!a.querySelector("[data-i18n='chat.restore']")) a.insertAdjacentHTML("beforeend", `<button class="btn btn--ghost btn--compact" type="button" data-i18n="chat.restore">${t("chat.restore")}</button>`)
        })
        thinking.querySelector(".chat-avatar").outerHTML = chatAvatar("still")
        bubble.className = "chat-bubble chat-swap-in"
        bubble.dataset.result = ""
        bubble.innerHTML = answer(text)
        if (!bubble.querySelector(".chat-actions")) delete bubble.dataset.result
        setBusy(false)
        scroll(instant)
      }, motionMs("--dur-fast-exit"))
    }, delay + motionMs("--hold-skeleton") + 900)
  }

  ta.addEventListener("input", () => {
    grow(ta)
    send.disabled = !busy && !ta.value.trim()
  })
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault()
      submit(ta.value, true)
    }
  })
  form.addEventListener("submit", (e) => {
    e.preventDefault()
    submit(ta.value, false)
  })
  log.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-send]")
    if (chip) submit(t(chip.dataset.send), e.detail === 0, chip.dataset.send)
  })
  root.querySelector(".js-chat-new").addEventListener("click", () => reset(false))
  document.querySelector(".js-chat-replay")?.addEventListener("click", () => {
    reset(false)
    later(() => submit(t("q"), false, "q"), 500)
    later(() => submit(t("chat.ex.follow"), false, "chat.ex.follow"), 4200)
  })
  reset(true)
}

const grow = (ta) => {
  if (CSS.supports("field-sizing", "content")) return
  ta.style.height = "auto"
  ta.style.height = `${ta.scrollHeight}px`
}

export const initChatInputs = () => {
  document.querySelectorAll(".chat-input textarea").forEach((ta) => {
    grow(ta)
    if (!ta.readOnly) ta.addEventListener("input", () => grow(ta))
  })
}

const playOnce = (el) => {
  el.classList.remove("is-playing")
  el.querySelectorAll(".mk-unfold").forEach((m) => m.replaceWith(m.cloneNode(true)))
  el.getBoundingClientRect()
  el.classList.add("is-playing")
}

export const initPlays = () => {
  document.querySelectorAll(".js-play").forEach((b) =>
    b.addEventListener("click", () => {
      const target = document.querySelector(b.dataset.target)
      if (target) playOnce(target)
    }),
  )
  const seen = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          playOnce(e.target)
          seen.unobserve(e.target)
        }
      }),
    { threshold: 0.5 },
  )
  document.querySelectorAll("[data-autoplay]").forEach((el) => seen.observe(el))
}
