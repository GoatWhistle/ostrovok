import { useCallback, useEffect, useRef, useState } from "react"

interface ReelClockInput {
  readonly enabled: boolean
  readonly visible: boolean
  readonly interruption: number
}

export function useReelClock({ enabled, visible, interruption }: ReelClockInput) {
  const [elapsed, setElapsed] = useState(0)
  const [wanted, setWanted] = useState(true)
  const base = useRef(0)
  useEffect(() => {
    if (interruption > 0) setWanted(false)
  }, [interruption])
  const running = enabled && visible && wanted
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
  const toggle = useCallback(() => setWanted((value) => !value), [])
  return { elapsed, playing: wanted, running, toggle }
}
