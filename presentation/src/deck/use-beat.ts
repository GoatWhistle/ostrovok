import { useEffect, useState } from "react"

export function useBeat(stepMs: number, limit: number, delayMs = 0) {
  const [beat, setBeat] = useState(0)
  useEffect(() => {
    let timer = window.setTimeout(function tick() {
      setBeat((value) => {
        const next = value + 1
        if (next < limit) timer = window.setTimeout(tick, stepMs)
        return next
      })
    }, delayMs)
    return () => window.clearTimeout(timer)
  }, [stepMs, limit, delayMs])
  return beat
}

export function useTyped(text: string, active: boolean, charMs = 38) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!active) return
    let frame = 0
    let started = 0
    const run = (now: number) => {
      started ||= now
      const next = Math.min(text.length, Math.floor((now - started) / charMs))
      setCount(next)
      if (next < text.length) frame = requestAnimationFrame(run)
    }
    frame = requestAnimationFrame(run)
    return () => cancelAnimationFrame(frame)
  }, [text, active, charMs])
  return active ? text.slice(0, count) : ""
}

export function useTimeline(marks: readonly number[]) {
  const [passed, setPassed] = useState(0)
  useEffect(() => {
    const timers = marks.map((mark, index) => window.setTimeout(() => setPassed(index + 1), mark))
    return () => {
      for (const timer of timers) window.clearTimeout(timer)
    }
  }, [marks])
  return passed
}
