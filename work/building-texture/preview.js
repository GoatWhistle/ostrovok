const [copy, building] = await Promise.all([
  fetch("copy.json").then((response) => response.json()),
  fetch("../../data/assets/zhemchuzhina/building.json").then((response) => response.json()),
])
const model = document.querySelector("model-viewer")
const status = document.querySelector("#status")
let locale = "ru"
let failed = false

function translate() {
  document.documentElement.lang = locale
  document.title = `${copy[locale].title} | Factmap`
  for (const element of document.querySelectorAll("[data-copy]")) {
    element.textContent = copy[locale][element.dataset.copy]
  }
  model.alt = copy[locale].alt
  document.querySelector("img").alt = copy[locale].atlas
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  const metres = new Intl.NumberFormat(locale, { style: "unit", unit: "meter", maximumFractionDigits: 0 })
  const rows = [
    ["osm", building.osm_id],
    ["dimensions", `${number.format(building.length_m)} × ${metres.format(building.width_m)}`],
    ["height", metres.format(building.height_m)],
    ["triangles", number.format(building.triangles)],
  ]
  document.querySelector("#facts").replaceChildren(...rows.flatMap(([key, value]) => {
    const term = document.createElement("dt")
    const description = document.createElement("dd")
    term.textContent = copy[locale][key]
    description.textContent = value
    return [term, description]
  }))
  status.hidden = model.loaded && !failed
  if (failed) status.textContent = copy[locale].error
}

document.querySelector("#language").addEventListener("click", () => {
  locale = locale === "ru" ? "en" : "ru"
  translate()
})
document.querySelector("#theme").addEventListener("click", () => {
  const root = document.documentElement
  root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light"
})
for (const button of document.querySelectorAll("[data-orbit]")) {
  button.addEventListener("click", () => {
    model.cameraOrbit = button.dataset.orbit
    model.jumpCameraToGoal()
  })
}
model.addEventListener("load", () => { status.hidden = true })
model.addEventListener("error", () => { failed = true; translate() })
translate()
