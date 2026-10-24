import { useEffect, useState } from "react"
import { useTheme } from "./use-theme"

function readColors() {
  const style = getComputedStyle(document.documentElement)
  return {
    surface: style.getPropertyValue("--surface-sunken").trim(),
    building: style.getPropertyValue("--text-muted").trim(),
    accent: style.getPropertyValue("--focus-ring").trim(),
  }
}
export function useMapColors() {
  const { theme } = useTheme()
  const [colors, setColors] = useState(readColors)
  useEffect(() => {
    if (document.documentElement.dataset.theme === theme) setColors(readColors())
  }, [theme])
  return colors
}
