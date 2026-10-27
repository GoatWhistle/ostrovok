import { useSyncExternalStore } from "react"
import { isMapAppearance } from "../geo/appearance/packages"
import type { AppearanceTarget, MapAppearance } from "../geo/appearance/types"

const STORAGE_KEY = "factmap-map-appearance"
const listeners = new Set<() => void>()
const targets = new Set<AppearanceTarget>()

function storedAppearance(): MapAppearance {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return isMapAppearance(value) ? value : "neon"
  } catch {
    return "neon"
  }
}

let state = { id: storedAppearance(), failed: false }
let requested = state.id
if (typeof document !== "undefined") document.documentElement.dataset.mapAppearance = state.id

function publish(id: MapAppearance, failed: boolean) {
  state = { id, failed }
  if (typeof document !== "undefined") document.documentElement.dataset.mapAppearance = id
  for (const listener of listeners) listener()
}

export function requestMapAppearance(id: MapAppearance): boolean {
  if (!isMapAppearance(id)) return false
  requested = id
  if (id === state.id && !state.failed) return true
  const previous = state.id
  try {
    for (const target of targets) target.applyAppearance(id)
  } catch {
    for (const target of targets) {
      try {
        target.applyAppearance(previous)
      } catch {}
    }
    publish(previous, true)
    return false
  }
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    publish(id, false)
    return true
  }
  publish(id, false)
  return true
}

export function retryMapAppearance(): MapAppearance | undefined {
  const id = requested
  return requestMapAppearance(id) ? id : undefined
}

export function registerMapAppearance(target: AppearanceTarget): () => void {
  target.applyAppearance(state.id)
  targets.add(target)
  return () => {
    targets.delete(target)
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useMapAppearance() {
  return useSyncExternalStore(subscribe, () => state)
}
