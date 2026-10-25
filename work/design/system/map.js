import { ICONS } from "./icons.js"

const rng = (seed) => () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const W = 1200
const H = 640
const SLOPE = -0.17
const BASE = 452
const NL = Math.hypot(SLOPE, 1)
const N = [SLOPE / NL, -1 / NL]
const lin = (s) => BASE + SLOPE * s
const coastY = (x) => lin(x) + 7 * Math.sin(x / 95) + 3 * Math.sin(x / 33)
const P = (s, d) => [s + N[0] * d, lin(s) + N[1] * d]
const f = (v) => v.toFixed(1)
const line = (arr) => `M${arr.map(([x, y]) => `${f(x)} ${f(y)}`).join(" L")}`
const poly = (arr) => `${line(arr)}Z`
const along = (d, s0 = -200, s1 = W + 200, step = 20) => {
  const a = []
  for (let s = s0; s <= s1; s += step) a.push(P(s, d))
  return a
}

const RAIL = 40
const ROADS = [
  { d: 118, major: true, name: "Курортный проспект" },
  { d: 200 },
  { d: 286, major: true, name: "улица Навагинская" },
  { d: 370 },
  { d: 452 },
  { d: 536 },
]
const BANDS = [
  [54, 110],
  [128, 192],
  [208, 278],
  [296, 362],
  [378, 444],
  [460, 528],
  [544, 620],
]
const STEP = 84
const CROSS = []
for (let s = -168; s <= W + 200; s += STEP) CROSS.push(s)
const RIVER_S = [756, 840]
const PARKS = [
  [2, 1],
  [12, 3],
  [5, 4],
]

const MAP_HOTEL = { s: 586, d: 132, w: 40, h: 46 }
const MAP_HOTELS = [
  { s: 420, d: 60, label: "3/3" },
  { s: 270, d: 140, label: "2/3" },
  { s: 860, d: 214, label: "3/3" },
  { s: 950, d: 62, label: "2/3" },
  { s: 120, d: 64, label: "2/3" },
  { s: 690, d: 300, label: "1/3", state: "visited" },
  { s: 1060, d: 138, label: "2/3" },
  { s: 360, d: 300, nodata: true },
  { s: 520, d: 220, nodata: true },
  { s: 1150, d: 400, label: "12", state: "cluster" },
]
const MAP_BARS = [
  [470, 118],
  [500, 118],
  [720, 118],
  [744, 118],
]

const buildingsFor = (rand) => {
  const out = []
  CROSS.forEach((s, i) => {
    const next = CROSS[i + 1]
    if (next === undefined) return
    const s0 = s + 8
    const s1 = next - 8
    if (s0 < RIVER_S[1] && s1 > RIVER_S[0]) return
    BANDS.forEach(([d0, d1], b) => {
      if (PARKS.some(([pi, pb]) => pi === i && pb === b)) return
      let x = s0
      while (x < s1 - 10) {
        const w = 12 + rand() * 20
        if (x + w > s1) break
        const depth = 12 + rand() * (d1 - d0 - 12)
        const front = rand() > 0.45
        const a = front ? d0 : d1 - depth
        const inHotel = x < MAP_HOTEL.s + MAP_HOTEL.w + 4 && x + w > MAP_HOTEL.s - 4 && b === 1
        if (!inHotel && rand() > 0.1) out.push(poly([P(x, a), P(x + w, a), P(x + w, a + depth), P(x, a + depth)]))
        x += w + 4 + rand() * 5
      }
    })
  })
  return out
}

const parksFor = () =>
  PARKS.map(([i, b]) => {
    const s0 = CROSS[i] + 8
    const s1 = CROSS[i + 1] - 8
    const [d0, d1] = BANDS[b]
    return poly([P(s0, d0), P(s1, d0), P(s1, d1), P(s0, d1)])
  })

const contoursFor = (rand) => {
  const out = []
  const hills = [
    [980, 560, 230],
    [240, 600, 260],
  ]
  for (const [cs, cd, r] of hills) {
    const offs = Array.from({ length: 5 }, () => rand() * 0.18)
    for (let k = 0; k < 5; k++) {
      const pts = []
      for (let a = 0; a <= 360; a += 8) {
        const tt = (a * Math.PI) / 180
        const n = 1 + offs.reduce((sum, o, i) => sum + o * Math.sin(tt * (i + 2) + i * 1.3), 0) * 0.5
        const rr = (r - k * 38) * n
        pts.push(P(cs + Math.cos(tt) * rr * 1.4, cd + Math.sin(tt) * rr * 0.55))
      }
      out.push(poly(pts))
    }
  }
  return out
}

const pinSvg = (h, i) => {
  const c = P(h.s + 18, h.d + 20)
  const x = c[0]
  const y = c[1] - 26
  if (h.nodata) return `<g class="m-pin-wrap" style="--i:${i}" transform="translate(${f(c[0])} ${f(c[1])})"><circle class="m-nodata" r="5"/></g>`
  const cluster = h.state === "cluster"
  const w = cluster ? 40 : 62
  const st = h.state ? ` data-state="${h.state}"` : ""
  const body = cluster
    ? `<rect class="m-shadow" x="${-w / 2}" y="-13" width="${w}" height="30" rx="15"/><rect class="m-pin-bg" x="${-w / 2}" y="-15" width="${w}" height="30" rx="15"/><text class="m-pin-t" x="0" y="5" text-anchor="middle">${h.label}</text>`
    : `<rect class="m-shadow" x="${-w / 2}" y="-13" width="${w}" height="30" rx="8"/><rect class="m-pin-bg" x="${-w / 2}" y="-15" width="${w}" height="30" rx="8"/><rect class="m-pin-dot" x="${-w / 2 + 6}" y="-9" width="18" height="18" rx="5"/><path class="m-pin-ic" transform="translate(${-w / 2 + 15} 0)" d="M-4 0.2 l2.8 2.8 L4.2 -3"/><text class="m-pin-t" x="${-w / 2 + 30}" y="5">${h.label}</text>`
  return `<g class="m-pin-wrap" style="--i:${i}" transform="translate(${f(x)} ${f(y)})"><g class="m-pin"${st}>${body}</g></g>`
}

export const buildMap = (opts = {}) => {
  const id = opts.id ?? "m"
  const rand = rng(opts.seed ?? 11)
  const coast = []
  for (let x = -40; x <= W + 40; x += 8) coast.push([x, coastY(x)])
  const landD = `${line(coast)} L${W + 40} -40 L-40 -40Z`
  const seaD = `${line(coast)} L${W + 40} ${H + 40} L-40 ${H + 40}Z`
  const beachD = `${line(coast)} L${along(28, -40, W + 40).reverse().map(([x, y]) => `${f(x)} ${f(y)}`).join(" L")}Z`
  const railD = line(along(RAIL))
  const roadsMajor = ROADS.filter((r) => r.major).map((r) => line(along(r.d))).join(" ")
  const roadsMinor = ROADS.filter((r) => !r.major).map((r) => line(along(r.d))).join(" ")
  const cross = CROSS.map((s, i) => {
    if (s > RIVER_S[0] - 10 && s < RIVER_S[1] + 10) return ""
    const from = (s / STEP) % 2 === 0 ? RAIL + 8 : ROADS[0].d
    return line([P(s, from), P(s, 700)])
  }).join(" ")
  const riverD = line([P(800, 700), P(806, 520), P(796, 360), P(804, 200), P(798, 60), P(800, 0), [P(800, 0)[0], coastY(P(800, 0)[0]) + 6]])
  const buildings = buildingsFor(rand)
  const parks = parksFor()
  const contours = contoursFor(rand)
  const hotelFoot = poly([P(MAP_HOTEL.s, MAP_HOTEL.d), P(MAP_HOTEL.s + MAP_HOTEL.w, MAP_HOTEL.d), P(MAP_HOTEL.s + MAP_HOTEL.w, MAP_HOTEL.d + MAP_HOTEL.h), P(MAP_HOTEL.s, MAP_HOTEL.d + MAP_HOTEL.h)])
  const hotelCenter = P(MAP_HOTEL.s + MAP_HOTEL.w / 2, MAP_HOTEL.d + MAP_HOTEL.h / 2)
  const door = P(MAP_HOTEL.s + MAP_HOTEL.w / 2, MAP_HOTEL.d)
  const crossS = 672
  const routePts = [door, P(MAP_HOTEL.s + MAP_HOTEL.w / 2, ROADS[0].d), P(crossS, ROADS[0].d), P(crossS, RAIL + 8), P(crossS, RAIL - 6), P(crossS, 14)]
  const routeD = line(routePts)
  const routeEnd = routePts.at(-1)
  const fanO = P(MAP_HOTEL.s + 6, MAP_HOTEL.d)
  const ray = (ang, len) => [fanO[0] + Math.cos(ang) * len, fanO[1] + Math.sin(ang) * len]
  const a0 = (134 * Math.PI) / 180
  const a1 = (156 * Math.PI) / 180
  const fanLen = 900
  const fanPts = [fanO]
  for (let a = a0; a <= a1 + 1e-6; a += (a1 - a0) / 8) fanPts.push(ray(a, fanLen))
  const fanD = poly(fanPts)
  const sunRay = ray((145 * Math.PI) / 180, 430)
  const noise = MAP_BARS.map(([s, d]) => {
    const [x, y] = P(s, d)
    return `<circle class="m-noise" cx="${f(x)}" cy="${f(y)}" r="26"/>`
  }).join("")
  const bars = MAP_BARS.map(([s, d]) => {
    const [x, y] = P(s, d + 10)
    return `<g class="m-poi" transform="translate(${f(x)} ${f(y)})"><circle r="7.5"/><path d="M-3.2 -3 h6.4 l-3.2 3.6 Z M0 0.6 v2.6 M-1.8 3.2 h3.6"/></g>`
  }).join("")
  const pins = [{ s: MAP_HOTEL.s + 2, d: MAP_HOTEL.d + 4, label: "3/3", state: "selected" }, ...MAP_HOTELS].map(pinSvg).join("")
  const roadLabel = ROADS.filter((r) => r.name)
    .map((r, i) => `<path id="${id}-rl${i}" d="${line(along(r.d, 60, 1100))}" fill="none"/><text class="m-road-label" dy="4"><textPath href="#${id}-rl${i}" startOffset="${i === 0 ? "16%" : "58%"}">${r.name}</textPath></text>`)
    .join("")
  const riverLabel = (() => {
    const [x, y] = P(812, 420)
    return `<text class="m-river-label" x="${f(x)}" y="${f(y)}" transform="rotate(-80 ${f(x)} ${f(y)})">р. Сочи</text>`
  })()
  const [lx, ly] = [routeEnd[0] + 16, routeEnd[1] + 24]

  const vb = `viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"`
  const base = `<svg ${vb} class="m-svg m-base" aria-hidden="true">
<defs><clipPath id="${id}-land"><path d="${landD}"/></clipPath></defs>
<rect class="m-land" x="-40" y="-40" width="${W + 80}" height="${H + 80}"/>
<path class="m-contours" d="${contours.join(" ")}"/>
<path class="m-park" d="${parks.join(" ")}"/>
<path class="m-sea" d="${seaD}"/>
<path class="m-sand" d="${beachD}"/>
<path class="m-coast" d="${line(coast)}"/>
<g clip-path="url(#${id}-land)">
<path class="m-river" d="${riverD}"/>
<path class="m-buildings" d="${buildings.join(" ")}"/>
<path class="m-road-casing" d="${roadsMinor} ${cross}"/>
<path class="m-road-casing m-major-casing" d="${roadsMajor}"/>
<path class="m-road" d="${roadsMinor} ${cross}"/>
<path class="m-road m-major" d="${roadsMajor}"/>
<path class="m-rail" d="${railD}"/>
<path class="m-rail-ties" d="${railD}"/>
</g>
${roadLabel}
${riverLabel}
<text class="m-water-label" x="150" y="${H - 50}">Чёрное море</text>
<text class="m-district" x="930" y="${f(P(930, 250)[1])}">ЦЕНТРАЛЬНЫЙ</text>
<g class="m-scale" transform="translate(70 ${H - 28})"><path d="M0 0 v6 h100 v-6"/><text x="108" y="8">300 м</text></g>
</svg>`
  const over = `<svg ${vb} class="m-svg m-over" role="img" aria-label="${opts.label ?? "Карта: отель Чайка, маршрут до моря 6 минут, закат виден с 4-го этажа"}">
<defs><clipPath id="${id}-sea"><path d="${seaD}"/></clipPath><pattern id="${id}-hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><line class="m-hatch" x1="0" y1="0" x2="0" y2="9"/></pattern></defs>
<g class="m-layer-noise">${noise}</g>
<g clip-path="url(#${id}-sea)"><path class="m-view" fill="url(#${id}-hatch)" d="${fanD}"/></g>
<path class="m-view-line" d="${line([fanO, sunRay])}"/>
<g class="m-sun" transform="translate(${f(sunRay[0])} ${f(sunRay[1])})"><circle r="15"/><path d="M-9 3 a9 9 0 0 1 18 0 M-13 6.5 h26"/></g>
<path class="m-fact-area" d="${hotelFoot}"/>
<circle class="m-fact-ping" cx="${f(hotelCenter[0])}" cy="${f(hotelCenter[1])}" r="26"/>
<path class="m-route-casing" d="${routeD}"/>
<path class="m-route" d="${routeD}" pathLength="1000"/>
<g class="m-route-end" transform="translate(${f(routeEnd[0])} ${f(routeEnd[1])})"><circle r="7"/><circle r="2.6" class="m-route-end-in"/></g>
<g class="m-route-label" transform="translate(${f(lx)} ${f(ly)})"><rect class="m-shadow" x="0" y="-14" width="132" height="32" rx="8"/><rect class="m-label-bg" x="0" y="-16" width="132" height="32" rx="8"/><g class="m-rl-ic" transform="translate(8 -9) scale(.75)">${ICONS.walk}</g><text x="32" y="5">6 мин, 420 м</text></g>
<g class="m-layer-poi">${bars}</g>
<g class="m-pins">${pins}</g>
</svg>`
  return `<div class="m-stack">${base}${over}</div>`
}

export const miniMap = (seed, variant = 0) => {
  const rand = rng(seed)
  const tilt = -14 + rand() * 10
  const coast = 80 + rand() * 18
  const b = []
  for (let i = 0; i < 9; i++) b.push(`<rect x="${8 + (i % 3) * 30 + rand() * 6}" y="${10 + Math.floor(i / 3) * 22 + rand() * 4}" width="${12 + rand() * 10}" height="${8 + rand() * 8}" rx="1.5"/>`)
  return `<svg viewBox="0 0 112 112" aria-hidden="true" class="m-svg m-mini"><rect class="m-land" width="112" height="112"/><g transform="rotate(${tilt} 56 56)"><g class="m-buildings">${b.join("")}</g><path class="m-road" d="M-10 72 H122" stroke-width="5"/><path class="m-sea" d="M-20 ${coast} Q 56 ${coast - 8} 132 ${coast} V140 H-20Z"/><path class="m-sand-line" d="M-20 ${coast - 3} Q 56 ${coast - 11} 132 ${coast - 3}"/></g><rect class="m-fact-area" x="${40 + variant * 6}" y="40" width="24" height="16" rx="2" transform="rotate(${tilt} 56 56)"/></svg>`
}
