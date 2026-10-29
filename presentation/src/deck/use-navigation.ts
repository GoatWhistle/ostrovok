import { useCallback, useEffect, useState } from "react"

const NEXT = new Set(["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"])
const PREVIOUS = new Set(["ArrowLeft", "ArrowUp", "PageUp", "Backspace"])
const REPLAY = new Set(["r", "R", "к", "К"])
const FULLSCREEN = new Set(["f", "F", "а", "А"])

function readHash(count: number): number {
  const value = Number.parseInt(window.location.hash.slice(1), 10)
  return Number.isFinite(value) ? Math.min(count, Math.max(1, value)) - 1 : 0
}

export function useNavigation(count: number) {
  const [index, setIndex] = useState(() => readHash(count))
  const [take, setTake] = useState(0)
  const go = useCallback(
    (next: number) => {
      const bounded = Math.min(count - 1, Math.max(0, next))
      setIndex(bounded)
      window.history.replaceState(null, "", `#${bounded + 1}`)
    },
    [count],
  )
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (NEXT.has(event.key)) go(index + 1)
      else if (PREVIOUS.has(event.key)) go(index - 1)
      else if (event.key === "Home") go(0)
      else if (event.key === "End") go(count - 1)
      else if (REPLAY.has(event.key)) setTake((value) => value + 1)
      else if (FULLSCREEN.has(event.key)) {
        if (document.fullscreenElement) void document.exitFullscreen()
        else void document.documentElement.requestFullscreen()
      } else return
      event.preventDefault()
    }
    const onClick = (event: MouseEvent) => {
      if ((event.target as HTMLElement).closest("[data-interactive]")) return
      go(event.clientX < window.innerWidth / 3 ? index - 1 : index + 1)
    }
    window.addEventListener("keydown", onKey)
    window.addEventListener("click", onClick)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("click", onClick)
    }
  }, [go, index, count])
  return { index, take }
}
