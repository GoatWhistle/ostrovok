import { useEffect, useState } from "react"
import { motionMs, useReducedMotion } from "@/shared/motion"

export function useTypedExample(examples: readonly string[], paused: boolean): string {
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [length, setLength] = useState(0)
  const example = examples[index % Math.max(examples.length, 1)] ?? ""
  useEffect(() => {
    if (reduced || paused || examples.length === 0) return
    const done = length >= example.length
    const delay = done ? motionMs("--dur-draw") * 2 : motionMs("--dur-instant") / 2
    const timer = window.setTimeout(() => {
      if (done) {
        setIndex((current) => current + 1)
        setLength(0)
      } else setLength((current) => current + 1)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [reduced, paused, examples.length, length, example.length])
  if (reduced || paused) return example
  return example.slice(0, length)
}
