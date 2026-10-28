import { useEffect, useRef } from "react"
import type { MapAppearance } from "@/shared/geo/appearance/types"
import { requestMapAppearance, useMapAppearance } from "@/shared/theme"

export function useAppearanceLocation(
  appearance: MapAppearance | undefined,
  onChange: (id: MapAppearance) => void,
) {
  const current = useMapAppearance()
  const applied = useRef<MapAppearance | undefined>(undefined)
  useEffect(() => {
    if (applied.current === appearance) return
    applied.current = appearance
    if (appearance && appearance !== current.id && !requestMapAppearance(appearance)) {
      applied.current = current.id
      onChange(current.id)
    }
  }, [appearance, current.id, onChange])
}
