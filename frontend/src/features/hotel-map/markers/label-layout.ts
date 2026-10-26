export type Placement = "start" | "end" | "top" | "bottom"

export interface Rectangle {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface LabelItem {
  readonly id: string
  readonly priority: number
  readonly anchor: Rectangle
  readonly size: { readonly width: number; readonly height: number }
  readonly candidates: readonly Placement[]
  readonly previous?: Placement | undefined
}

export function intersects(first: Rectangle, second: Rectangle, margin = 2): boolean {
  return (
    first.x < second.x + second.width + margin &&
    first.x + first.width + margin > second.x &&
    first.y < second.y + second.height + margin &&
    first.y + first.height + margin > second.y
  )
}

function fits(rect: Rectangle, bounds: Rectangle) {
  return (
    rect.x >= bounds.x &&
    rect.y >= bounds.y &&
    rect.x + rect.width <= bounds.x + bounds.width &&
    rect.y + rect.height <= bounds.y + bounds.height
  )
}

export function labelRectangle(item: LabelItem, placement: Placement, gap = 8): Rectangle {
  const { anchor, size } = item
  const middleX = anchor.x + (anchor.width - size.width) / 2
  const middleY = anchor.y + (anchor.height - size.height) / 2
  const positions: Record<Placement, readonly [number, number]> = {
    start: [anchor.x - size.width - gap, middleY],
    end: [anchor.x + anchor.width + gap, middleY],
    top: [middleX, anchor.y - size.height - gap],
    bottom: [middleX, anchor.y + anchor.height + gap],
  }
  const [x, y] = positions[placement]
  return { x, y, ...size }
}

export function layoutLabels(
  items: readonly LabelItem[],
  bounds: Rectangle,
  forbidden: readonly Rectangle[],
  gap = 8,
): ReadonlyMap<string, Placement | "hidden"> {
  const occupied = [...forbidden]
  const placements = new Map<string, Placement | "hidden">()
  const ordered = [...items].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
  for (const item of ordered) {
    const candidates = item.previous
      ? [item.previous, ...item.candidates.filter((value) => value !== item.previous)]
      : item.candidates
    const placement = candidates.find((candidate) => {
      const rect = labelRectangle(item, candidate, gap)
      return fits(rect, bounds) && !occupied.some((other) => intersects(rect, other))
    })
    placements.set(item.id, placement ?? "hidden")
    if (placement) occupied.push(labelRectangle(item, placement, gap))
  }
  return placements
}
