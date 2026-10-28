import { useSyncExternalStore } from "react"
import type { SunPosition } from "@/shared/geo/terrain/terrain"

export interface PreviewedSun {
  readonly hour: number
  readonly position: SunPosition
}

export interface SunPreview {
  get(): PreviewedSun | null
  set(value: PreviewedSun | null): void
  subscribe(listener: () => void): () => void
}

export function createSunPreview(): SunPreview {
  let value: PreviewedSun | null = null
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set(next) {
      value = next
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

const idle = () => () => undefined
const none = () => null

export function usePreviewedSun(preview: SunPreview | undefined): PreviewedSun | null {
  return useSyncExternalStore(preview?.subscribe ?? idle, preview?.get ?? none)
}
