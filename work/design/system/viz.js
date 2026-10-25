import { icon } from "./icons.js"

const f1 = (v) => v.toFixed(1)

export const vizNoise = () => {
  const level = 2
  const cells = Array.from({ length: 10 }, (_, i) => `<i class="${i < level ? "on" : ""}"></i>`).join("")
  return `<div class="viz-cap"><b>2 из 10</b><span>тихо, западный фасад</span></div>
<div class="noise" role="img" aria-label="Шум 2 из 10">${cells}</div>
<div class="noise-scale"><span>0 тишина</span><span>5</span><span>10 магистраль</span></div>
<ul class="noise-src">
<li>${icon("route", 16)}<span>Курортный проспект</span><span class="mono">140 м, фасад отвёрнут</span></li>
<li>${icon("nightlife", 16)}<span>Бары, 2 места</span><span class="mono">210 м</span></li>
<li>${icon("compare", 16)}<span>Железная дорога</span><span class="mono">320 м</span></li>
</ul>`
}

export const vizElevation = () => {
  const pts = [[0, 24], [40, 24], [80, 22], [120, 21], [160, 18], [200, 16], [230, 17], [260, 13], [300, 9], [340, 6], [380, 3], [420, 1]]
  const W = 460
  const H = 150
  const pad = { l: 34, r: 10, t: 12, b: 26 }
  const x = (m) => pad.l + (m / 420) * (W - pad.l - pad.r)
  const y = (e) => pad.t + (1 - e / 30) * (H - pad.t - pad.b)
  const line = pts.map(([m, e], i) => `${i ? "L" : "M"}${f1(x(m))} ${f1(y(e))}`).join(" ")
  const area = `${line} L${f1(x(420))} ${f1(y(0))} L${f1(x(0))} ${f1(y(0))}Z`
  const gy = [0, 10, 20, 30].map((e) => `<line class="viz-grid-line" x1="${pad.l}" x2="${W - pad.r}" y1="${f1(y(e))}" y2="${f1(y(e))}"/><text class="viz-axis" x="${pad.l - 6}" y="${f1(y(e) + 3)}" text-anchor="end">${e}</text>`).join("")
  const gx = [0, 140, 280, 420].map((m) => `<text class="viz-axis" x="${f1(x(m))}" y="${H - 8}" text-anchor="middle">${m} м</text>`).join("")
  const mark = (m, e, label, anchor = "middle") => `<circle cx="${f1(x(m))}" cy="${f1(y(e))}" r="4.5" fill="var(--surface-raised)" stroke="var(--hue)" stroke-width="2.5"/><text class="viz-axis" x="${f1(x(m))}" y="${f1(y(e) - 10)}" text-anchor="${anchor}" style="fill: var(--text-secondary); font-family: var(--font-sans); font-weight: 650">${label}</text>`
  return `<div class="viz-cap"><b>6 мин</b><span>420 м, спуск 23 м, подъёмов нет</span></div>
<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Профиль высот: от 24 метров у отеля до 1 метра у моря за 420 метров">
${gy}${gx}
<path d="${area}" fill="var(--hue)" fill-opacity="0.12"/>
<path d="${line}" fill="none" stroke="var(--hue)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
<line x1="${f1(x(345))}" x2="${f1(x(345))}" y1="${f1(y(30))}" y2="${f1(y(0))}" stroke="var(--border-strong)" stroke-dasharray="3 4"/>
<text class="viz-axis" x="${f1(x(345) + 6)}" y="${f1(y(28))}">путь под ж/д</text>
${mark(0, 24, "отель", "start")}${mark(420, 1, "пляж", "end")}
</svg>`
}

export const vizSunset = () => {
  const months = ["Я", "Ф", "М", "А", "М", "И", "И", "А", "С", "О", "Н", "Д"]
  const floors = [4, 4, 5, null, null, null, null, null, 6, 4, 4, 4]
  const now = 9
  const cells = months
    .map((m, i) => {
      const fl = floors[i]
      const cls = [fl ? "on" : "", i === now ? "now" : ""].filter(Boolean).join(" ")
      return `<span class="${cls}" title="${m}">${m}<b>${fl ? `${fl}+` : "нет"}</b></span>`
    })
    .join("")
  return `<div class="viz-cap"><b>7 месяцев</b><span>с сентября по март, с 4-го этажа</span></div>
<div class="months" role="img" aria-label="Закат виден с сентября по март, с 4 до 6 этажа; с апреля по август солнце садится за горой">${cells}</div>
<div class="note">${icon("info", 14)}<span>С апреля по август солнце садится за мысом: этаж не поможет.</span></div>`
}

export const vizFloors = () => {
  const total = 9
  const rows = Array.from({ length: total }, (_, k) => {
    const fl = total - k
    const cls = fl === 6 ? "mine" : fl >= 4 ? "view" : ""
    const tag = fl === 6 ? "ваш" : fl >= 4 ? "закат" : ""
    return `<span class="${cls}"><b>${fl}</b><em style="font-style:normal">${tag}</em></span>`
  }).join("")
  return `<div class="floors"><div class="building" role="img" aria-label="Девятиэтажное здание: закат виден с 4 по 9 этаж, ваш номер на 6 этаже">${rows}</div>
<ul class="floors-legend">
<li><i style="background: color-mix(in oklab, var(--hue-sunset) 22%, var(--surface-raised)); box-shadow: inset 0 0 0 1px var(--border-default)"></i>Закат виден, 4–9 этаж</li>
<li><i style="background: var(--action-primary)"></i>Номер в выдаче, 6 этаж</li>
<li><i style="background: var(--surface-raised); box-shadow: inset 0 0 0 1px var(--border-default)"></i>Вид закрывают соседние дома</li>
<li class="mono" style="color: var(--text-muted)">building:levels 9, уверенность 0,7</li>
</ul></div>`
}

export const vizDecay = () => {
  const W = 460
  const H = 150
  const pad = { l: 34, r: 10, t: 12, b: 26 }
  const x = (d) => pad.l + (d / 240) * (W - pad.l - pad.r)
  const y = (c) => pad.t + (1 - c) * (H - pad.t - pad.b)
  const c0 = 0.72
  const at = (d) => c0 * (1 - 0.5 * Math.min(d, 182) / 182) * (d > 182 ? 1 - ((d - 182) / 182) * 0.3 : 1)
  const live = []
  for (let d = 0; d <= 182; d += 7) live.push(`${live.length ? "L" : "M"}${f1(x(d))} ${f1(y(at(d)))}`)
  const stale = []
  for (let d = 182; d <= 240; d += 7) stale.push(`${stale.length ? "L" : "M"}${f1(x(d))} ${f1(y(at(d)))}`)
  const gy = [0, 0.5, 1].map((c) => `<line class="viz-grid-line" x1="${pad.l}" x2="${W - pad.r}" y1="${f1(y(c))}" y2="${f1(y(c))}"/><text class="viz-axis" x="${pad.l - 6}" y="${f1(y(c) + 3)}" text-anchor="end">${String(c).replace(".", ",")}</text>`).join("")
  const lbl = [[0, "24.10"], [91, "янв"], [182, "24.04"], [240, "июнь"]].map(([d, t]) => `<text class="viz-axis" x="${f1(x(d))}" y="${H - 8}" text-anchor="middle">${t}</text>`).join("")
  return `<div class="viz-cap"><b>0,72</b><span>сейчас, к 24.04.2027 снизится до 0,36</span></div>
<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Уверенность 0,72 сегодня, к концу срока 24 апреля 2027 снижается до 0,36, дальше факт устаревший">
${gy}${lbl}
<rect x="${f1(x(182))}" y="${pad.t}" width="${f1(x(240) - x(182))}" height="${H - pad.t - pad.b}" fill="var(--surface-sunken)"/>
<text class="viz-axis" x="${f1(x(188))}" y="${pad.t + 12}">устарел</text>
<path d="${live.join(" ")}" fill="none" stroke="var(--hue)" stroke-width="2.5" stroke-linecap="round"/>
<path d="${stale.join(" ")}" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-dasharray="4 4"/>
<circle cx="${f1(x(1))}" cy="${f1(y(at(1)))}" r="5" fill="var(--hue)" stroke="var(--surface-raised)" stroke-width="2"/>
</svg>`
}

export const vizMatch = () => {
  const rows = [
    ["quiet", "--hue-quiet", "Тихо", 1, "2 из 10"],
    ["sunset", "--hue-sunset", "Закат из окна", 0.8, "с 4-го"],
    ["walk", "--hue-walk", "Недалеко от моря", 1, "6 мин"],
    ["nightlife", "--hue-nightlife", "Бары рядом", 0.4, "210 м"],
  ]
  return `<div class="viz-cap"><b>3 из 4</b><span>одно пожелание частично</span></div>
<div class="match-bars">${rows
    .map(([ic, hue, name, w, val]) => `<div class="match-bar" style="--hue: var(${hue})">${icon(ic, 20)}<div class="stack" style="gap:6px"><span>${name}</span><span class="match-track" role="img" aria-label="${name}: ${Math.round(w * 100)} процентов"><i style="--w:${w * 100}%"></i></span></div><span class="mono">${val}</span></div>`)
    .join("")}</div>`
}

export const vizCompare = () => {
  const hotels = [
    ["Чайка", "Центральный, 3/3"],
    ["Ривьера", "Хоста, 3/3"],
    ["Магнолия", "Центральный, 2/3"],
  ]
  const ok = icon("confirmed", 16, "st st--ok")
  const part = icon("partial", 16, "st st--part")
  const no = icon("rejected", 16, "st st--no")
  const unk = icon("unknown", 16, "st st--unk")
  const rows = [
    ["quiet", "--hue-quiet", "Тихо", [[ok, "2 из 10", true], [ok, "3 из 10"], [ok, "3 из 10"]]],
    ["sunset", "--hue-sunset", "Закат из окна", [[ok, "с 4-го"], [ok, "с любого", true], [part, "с 8-го"]]],
    ["walk", "--hue-walk", "До моря пешком", [[ok, "6 мин"], [ok, "4 мин", true], [no, "9 мин, подъём"]]],
    ["pets", "--hue-pets", "С собакой", [[ok, "до 10 кг", true], [unk, "нет данных"], [no, "нельзя"]]],
    ["blackout", "--hue-dark", "Блэкаут", [[ok, "есть", true], [ok, "есть", true], [unk, "нет данных"]]],
  ]
  const head = `<thead><tr><th><span>Пожелание</span></th>${hotels.map(([n, d]) => `<th><b>${n}</b><span>${d}</span></th>`).join("")}</tr></thead>`
  const body = rows
    .map(([ic, hue, name, cells]) => `<tr><td><span class="cmp-row" style="--hue: var(${hue})">${icon(ic, 18)}${name}</span></td>${cells.map(([st, v, best]) => `<td><span class="cell${best ? " best" : ""}">${st}${v}</span></td>`).join("")}</tr>`)
    .join("")
  return head + `<tbody>${body}</tbody>`
}
