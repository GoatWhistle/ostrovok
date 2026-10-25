import { type Map as MapLibreMap, Marker } from "maplibre-gl"
import type { MessageKey } from "@/shared/i18n"
import type { Shot } from "./shots"

export interface ReelMark {
  readonly key: string
  readonly element: HTMLElement
  readonly name: MessageKey
  readonly marker: Marker
}

export function placeMarks(map: MapLibreMap, shot: Shot): ReelMark[] {
  return shot.marks.map((mark, step) => {
    const at: [number, number] = [mark.at[0], mark.at[1]]
    const element = document.createElement("div")
    element.setAttribute("aria-hidden", "true")
    element.style.setProperty("--mark-step", String(step))
    const marker = new Marker({ element, anchor: "bottom" }).setLngLat(at).addTo(map)
    return {
      key: `${shot.id}-${step}`,
      element,
      name: mark.name,
      marker,
    }
  })
}
