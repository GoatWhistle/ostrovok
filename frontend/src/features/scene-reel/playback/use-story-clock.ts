import { type RefObject, useCallback, useEffect, useRef, useState } from "react"

interface StoryClockInput {
  readonly target: RefObject<HTMLElement | null>
  readonly total: number
  readonly enabled: boolean
  readonly visible: boolean
  readonly reduced: boolean
  readonly interruption: number
}

export function useStoryClock({
  target,
  total,
  enabled,
  visible,
  reduced,
  interruption,
}: StoryClockInput) {
  const clock = useRef<Animation | null>(null)
  const attempted = useRef(false)
  const [started, setStarted] = useState(false)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const pause = useCallback(() => {
    attempted.current = true
    clock.current?.pause()
    if (clock.current) setTime(Math.min(total, Number(clock.current.currentTime ?? 0)))
    setPlaying(false)
  }, [total])
  useEffect(() => {
    if (reduced || !target.current || total <= 0 || typeof Animation === "undefined") return
    const animation = new Animation(
      new KeyframeEffect(target.current, [{ opacity: 1 }, { opacity: 1 }], {
        duration: total,
        fill: "both",
      }),
      document.timeline,
    )
    animation.pause()
    animation.currentTime = attempted.current ? total : 0
    clock.current = animation
    return () => {
      animation.cancel()
      clock.current = null
    }
  }, [target, total, reduced])
  useEffect(() => {
    if (interruption > 0) pause()
  }, [interruption, pause])
  useEffect(() => {
    if (!visible || reduced || (!enabled && started)) pause()
    if (reduced) setTime(total)
  }, [visible, reduced, pause, total, enabled, started])
  const play = useCallback(() => {
    if (!enabled || !visible || reduced || !clock.current) return
    attempted.current = true
    setStarted(true)
    setPlaying(true)
  }, [enabled, visible, reduced])
  useEffect(() => {
    if (enabled && visible && !reduced && !attempted.current) play()
  }, [enabled, visible, reduced, play])
  useEffect(() => {
    const animation = clock.current
    if (!playing || !animation) return
    let frame = 0
    const tick = () => {
      const elapsed = Math.min(total, Number(animation.currentTime ?? 0))
      setTime(elapsed)
      if (elapsed >= total || animation.playState !== "running") setPlaying(false)
      else frame = requestAnimationFrame(tick)
    }
    animation.play()
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      animation.pause()
    }
  }, [playing, total])
  const replay = () => {
    if (reduced || !clock.current) return
    clock.current.currentTime = 0
    setTime(0)
    play()
  }
  return {
    time: reduced || !enabled || !started ? total : time,
    elapsed: time,
    started,
    playing,
    supported: typeof Animation !== "undefined",
    pause,
    play,
    replay,
  }
}
