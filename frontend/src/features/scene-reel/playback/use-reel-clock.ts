import { useEffect, useRef, useState } from "react"

export function useReelClock(running: boolean) {
  const [elapsed, setElapsed] = useState(0)
  const base = useRef(0)
  useEffect(() => {
    if (!running) return
    let frame = 0
    let start = Number.NaN
    const tick = (now: number) => {
      if (Number.isNaN(start)) start = now - base.current
      base.current = now - start
      setElapsed(base.current)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [running])
  return elapsed
}
