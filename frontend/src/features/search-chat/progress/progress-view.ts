import type { ChatProgress } from "@/shared/api"

export type StepId = "parse" | "hotels" | "wishes" | "answer"
export type WishState = "queued" | "checking" | "verified" | "partial" | "missing" | "unknown"

export const STEPS: readonly StepId[] = ["parse", "hotels", "wishes", "answer"]

export interface ProgressWish {
  readonly term: string
  readonly key: string
  readonly state: WishState
}

export interface ProgressView {
  readonly step: number
  readonly location: string | undefined
  readonly checkIn: string | undefined
  readonly checkOut: string | undefined
  readonly adults: number | undefined
  readonly wishes: readonly ProgressWish[]
}

const STEP_OF_STAGE: Readonly<Record<string, number>> = {
  parsing: 0,
  parsed: 1,
  candidates: 2,
  research: 2,
  wish: 2,
  review: 3,
}

const STATE_OF_STATUS: Readonly<Record<string, WishState>> = {
  matched: "verified",
  needs_input: "partial",
  exhausted: "missing",
  incomplete: "unknown",
  unavailable: "unknown",
}

const normal = (term: string) => term.trim().toLocaleLowerCase()

function verdicts(events: readonly ChatProgress[]): Map<string, WishState> {
  const found = new Map<string, WishState>()
  for (const event of events)
    if (event.stage === "wish" && event.term)
      found.set(normal(event.term), STATE_OF_STATUS[event.status ?? ""] ?? "unknown")
  return found
}

function wishesOf(events: readonly ChatProgress[], researching: boolean): ProgressWish[] {
  const parsed = events.findLast((event) => event.stage === "parsed")
  const states = verdicts(events)
  const waiting: WishState = researching ? "checking" : "queued"
  const listed = (parsed?.intents ?? []).map((intent) => ({
    term: intent.term,
    key: intent.key,
    state: states.get(normal(intent.term)) ?? waiting,
  }))
  const known = new Set(listed.map((wish) => normal(wish.term)))
  const extra = events
    .filter((event) => event.stage === "wish" && event.term && !known.has(normal(event.term)))
    .map((event) => ({
      term: event.term ?? "",
      key: "",
      state: states.get(normal(event.term ?? "")) ?? "unknown",
    }))
  return [...listed, ...extra]
}

export function progressView(events: readonly ChatProgress[]): ProgressView {
  const step = Math.max(0, ...events.map((event) => STEP_OF_STAGE[event.stage] ?? 0))
  const parsed = events.findLast((event) => event.stage === "parsed")
  const researching = events.some((event) => event.stage === "research" || event.stage === "wish")
  return {
    step,
    location: parsed?.location ?? undefined,
    checkIn: parsed?.check_in ?? undefined,
    checkOut: parsed?.check_out ?? undefined,
    adults: parsed?.adults ?? undefined,
    wishes: wishesOf(events, researching),
  }
}
