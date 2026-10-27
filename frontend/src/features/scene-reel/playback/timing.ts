import { motionMs } from "@/shared/motion"

export function reelTiming() {
  return {
    shot: motionMs("--story-shot"),
    flight: motionMs("--story-flight"),
    draw: motionMs("--story-draw"),
    label: motionMs("--story-label"),
    caret: motionMs("--story-caret"),
    pulse: motionMs("--story-pulse"),
    fade: motionMs("--story-fade"),
  }
}

export type ReelTiming = ReturnType<typeof reelTiming>
