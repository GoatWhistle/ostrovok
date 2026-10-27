import { useEffect } from "react"

const opened = new Set<string>()
const prefix = "hotel-workspace-open:"

export function hasExpandedWorkspace(scope: string) {
  if (opened.has(scope)) return true
  try {
    return sessionStorage.getItem(prefix + scope) === "true"
  } catch {
    return false
  }
}

export function useWorkspaceExpansion(scope: string, hasHotels: boolean) {
  useEffect(() => {
    if (!hasHotels || opened.has(scope)) return
    opened.add(scope)
    try {
      sessionStorage.setItem(prefix + scope, "true")
    } catch {
      return
    }
  }, [scope, hasHotels])
  return hasHotels || hasExpandedWorkspace(scope)
}
