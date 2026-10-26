import type { Map as MapLibreMap } from "maplibre-gl"
import { type RefObject, useLayoutEffect } from "react"
import type { MarkerView } from "../marker-view"
import { type LabelItem, layoutLabels, type Placement, type Rectangle } from "./label-layout"

function rectangle(element: Element, frame: DOMRect): Rectangle {
  const box = element.getBoundingClientRect()
  return { x: box.x - frame.x, y: box.y - frame.y, width: box.width, height: box.height }
}

function priority(view: MarkerView): number {
  if (view.kind === "hotel") {
    if (view.selected) return 100
    return view.element.matches(":hover, :focus-within") ? 40 : 0
  }
  if (view.kind !== "cluster" && view.quiet && !view.element.matches(":hover, :focus-within"))
    return 0
  return view.kind === "route" ? 80 : 60
}

function candidates(
  view: MarkerView,
  anchor: Rectangle,
  hotel: Rectangle | undefined,
): Placement[] {
  if (view.kind === "hotel") return ["top", "bottom", "end", "start"]
  if (view.kind === "route" && hotel && anchor.x < hotel.x) return ["start", "end", "top", "bottom"]
  return ["end", "start", "top", "bottom"]
}

export function useMarkerLabels(
  mapRef: RefObject<MapLibreMap | null>,
  ready: boolean,
  views: readonly MarkerView[],
) {
  useLayoutEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const container = map.getContainer()
    const stage = container.parentElement
    const sizes = new Map<Element, { width: number; height: number }>()
    const previous = new Map<string, Placement>()
    let frameId = 0
    const labels = views.flatMap((view) => {
      const label = view.element.querySelector<HTMLElement>("[data-map-label]")
      return label ? [{ view, label }] : []
    })
    const arrange = () => {
      frameId = 0
      const frame = container.getBoundingClientRect()
      const obstacles = [...(stage?.querySelectorAll("[data-map-obstacle]") ?? [])]
        .map((element) => rectangle(element, frame))
        .filter((box) => box.width > 0 && box.height > 0)
      const anchors = new Map(views.map((view) => [view.key, rectangle(view.element, frame)]))
      const selected = views.find((view) => view.kind === "hotel" && view.selected)
      const hotel = selected ? anchors.get(selected.key) : undefined
      const items: LabelItem[] = labels.flatMap(({ view, label }) => {
        const anchor = anchors.get(view.key)
        const size = sizes.get(label)
        const importance = priority(view)
        if (!anchor || !size || !importance) return []
        return [
          {
            id: view.key,
            anchor,
            size,
            priority: importance,
            candidates: candidates(view, anchor, hotel),
            previous: previous.get(view.key),
          },
        ]
      })
      const gap = Number.parseFloat(getComputedStyle(container).getPropertyValue("--space-8")) || 8
      const result = layoutLabels(
        items,
        { x: gap, y: gap, width: frame.width - 2 * gap, height: frame.height - 2 * gap },
        [...obstacles, ...anchors.values()],
        gap,
      )
      for (const { view } of labels) {
        const placement = result.get(view.key) ?? "hidden"
        view.element.dataset.placement = placement
        if (placement !== "hidden") previous.set(view.key, placement)
      }
    }
    const schedule = () => {
      if (!frameId) frameId = requestAnimationFrame(arrange)
    }
    const observer = new ResizeObserver(() => {
      for (const { label } of labels)
        sizes.set(label, { width: label.offsetWidth, height: label.offsetHeight })
      schedule()
    })
    for (const { label } of labels) observer.observe(label)
    if (stage) observer.observe(stage)
    container.addEventListener("pointerover", schedule)
    container.addEventListener("pointerout", schedule)
    container.addEventListener("focusin", schedule)
    container.addEventListener("focusout", schedule)
    map.on("move", schedule)
    map.on("moveend", schedule)
    schedule()
    return () => {
      cancelAnimationFrame(frameId)
      observer.disconnect()
      container.removeEventListener("pointerover", schedule)
      container.removeEventListener("pointerout", schedule)
      container.removeEventListener("focusin", schedule)
      container.removeEventListener("focusout", schedule)
      map.off("move", schedule)
      map.off("moveend", schedule)
    }
  }, [mapRef, ready, views])
}
