import { use } from "react"
import { isTheme, type Theme } from "./theme"
import { ThemeContext, ThemeSetterContext, type ThemeState } from "./theme-provider"

export function useTheme(): ThemeState {
  const value = use(ThemeContext)
  if (value === null) throw new Error("useTheme must be used within ThemeProvider")
  return value
}

export function useSetTheme(): ThemeState["setTheme"] {
  const value = use(ThemeSetterContext)
  if (value === null) throw new Error("useSetTheme must be used within ThemeProvider")
  return value
}

export function currentTheme(): Theme {
  const value = document.documentElement.dataset.theme
  return isTheme(value) ? value : "light"
}
