import { useEffect, useState } from "react"
import { motionMs, useReducedMotion } from "@/shared/motion"

export interface TypedExample {
  readonly text: string
  readonly index: number
  readonly done: boolean
}

export function useTypedExample(examples: readonly string[], paused: boolean): TypedExample {
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [length, setLength] = useState(0)
  const position = index % Math.max(examples.length, 1)
  const example = examples[position] ?? ""
  const still = reduced || paused
  useEffect(() => {
    if (paused || examples.length === 0) return
    const done = reduced || length >= example.length
    const delay = done ? motionMs("--reel-life") : motionMs("--dur-instant") / 2
    const timer = window.setTimeout(() => {
      if (done) {
        setIndex((current) => current + 1)
        setLength(0)
      } else setLength((current) => current + 1)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [reduced, paused, examples.length, length, example.length])
  if (still) return { text: example, index: position, done: true }
  return { text: example.slice(0, length), index: position, done: length >= example.length }
}
