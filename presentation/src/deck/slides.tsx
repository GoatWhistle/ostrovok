import type { ReactNode } from "react"
import type { Direction, Highlight } from "../city/city-scene"
import { ArchitectureSlide } from "../slides/architecture/architecture-slide"
import { CardSlide } from "../slides/card/card-slide"
import { ChatSlide } from "../slides/chat/chat-slide"
import { CoverSlide } from "../slides/cover/cover-slide"
import { type FactKey, FactsSlide } from "../slides/facts/facts-slide"
import { FinalSlide } from "../slides/final/final-slide"
import { LayersSlide } from "../slides/layers/layers-slide"
import { PipelineSlide } from "../slides/pipeline/pipeline-slide"
import { ProblemSlide } from "../slides/problem/problem-slide"
import { WebSlide } from "../slides/web/web-slide"
import { PATHS } from "./shots"

export interface SlideContext {
  readonly direct: (direction: Direction) => void
}

export interface DeckSlide {
  readonly id: string
  readonly direction: Direction
  readonly bare?: boolean
  readonly dimmed?: boolean
  readonly render: (context: SlideContext) => ReactNode
}

const FACT_HIGHLIGHTS: Readonly<Record<FactKey, readonly Highlight[]>> = {
  sea: ["hero", "route"],
  quiet: ["hero", "facade"],
  height: ["hero"],
}

const day = (hour: number) => ({ kind: "fixed", hour }) as const

const factsDirection: Direction = { path: PATHS.hero, clock: day(17.6), highlights: ["hero"], shift: -0.25 }

export const SLIDES: readonly DeckSlide[] = [
  {
    id: "cover",
    bare: true,
    direction: { path: PATHS.cover, clock: { kind: "sweep", from: 11, to: 21.4, seconds: 30 }, highlights: [] },
    render: () => <CoverSlide />,
  },
  {
    id: "problem",
    direction: { path: PATHS.problem, clock: day(16), highlights: [], shift: -0.25 },
    render: () => <ProblemSlide />,
  },
  {
    id: "chat",
    direction: { path: PATHS.overview, clock: day(16.5), highlights: [], hidden: true },
    render: () => <ChatSlide />,
  },
  {
    id: "facts",
    direction: factsDirection,
    render: ({ direct }) => (
      <FactsSlide
        onFocus={(fact) => direct({ ...factsDirection, highlights: fact ? FACT_HIGHLIGHTS[fact] : ["hero"] })}
      />
    ),
  },
  {
    id: "layers",
    direction: { path: PATHS.overview, clock: day(15), highlights: [], shift: -0.16 },
    render: ({ direct }) => <LayersSlide direct={direct} />,
  },
  {
    id: "web",
    direction: { path: PATHS.sea, clock: day(15), highlights: [], hidden: true },
    render: () => <WebSlide />,
  },
  {
    id: "card",
    direction: { path: PATHS.heroClose, clock: day(11), highlights: ["hero", "route"], shift: -0.25 },
    render: () => <CardSlide />,
  },
  {
    id: "architecture",
    direction: { path: PATHS.overview, clock: day(12), highlights: [], hidden: true },
    render: () => <ArchitectureSlide />,
  },
  {
    id: "pipeline",
    direction: { path: PATHS.overview, clock: day(12), highlights: [], hidden: true },
    render: () => <PipelineSlide />,
  },
  {
    id: "final",
    bare: true,
    direction: { path: PATHS.final, clock: day(18.2), highlights: ["hotels"] },
    render: () => <FinalSlide />,
  },
]
