import { useEffect, useState } from "react"
import { motionMs } from "@/shared/motion"

const SECOND = 1000

function clock(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`
}

export function useThinkingClock(): string {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    const started = Date.now()
    const timer = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / SECOND)),
      motionMs("--delay-clock-tick"),
    )
    return () => window.clearInterval(timer)
  }, [])
  return clock(seconds)
}
