import { motionMs } from "@/shared/motion"

export function coverTiming() {
  return {
    total: motionMs("--story-sequence"),
    windowAt: motionMs("--story-at-window"),
    typeDelay: motionMs("--story-at-type"),
    firstType: motionMs("--story-type-first"),
    secondType: motionMs("--story-type-second"),
    caret: motionMs("--story-caret"),
    flightAt: motionMs("--story-at-flight"),
    arrivalAt: motionMs("--story-at-arrival"),
    selectionAt: motionMs("--story-at-selected"),
    selection: motionMs("--story-selected"),
    goalAt: motionMs("--story-at-goal"),
    routeAt: motionMs("--story-at-route"),
    route: motionMs("--story-route"),
    proof: motionMs("--story-proof"),
    requestIn: motionMs("--story-request-in"),
    requestOutAt: motionMs("--story-at-request-out"),
    requestOut: motionMs("--story-request-out"),
    swap: motionMs("--story-swap"),
    windowArrival: motionMs("--story-at-window-arrival"),
    dissolveAt: motionMs("--story-at-dissolve"),
    dissolve: motionMs("--story-dissolve"),
    openAt: motionMs("--story-at-open"),
    open: motionMs("--story-open"),
    finishAt: motionMs("--story-at-finish"),
    finish: motionMs("--story-finish"),
    driftEnd: motionMs("--story-at-drift-end"),
    windowRequestOut: motionMs("--story-at-window-request-out"),
  }
}

export type CoverTiming = ReturnType<typeof coverTiming>
