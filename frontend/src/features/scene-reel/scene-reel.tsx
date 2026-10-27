import { lazy, Suspense, useRef } from "react"
import { useReducedMotion } from "@/shared/motion"
import { ContentBoundary } from "@/shared/ui"
import { StaticCover } from "./static-cover"

const Sequence = lazy(() =>
  import("./cover-sequence").then((module) => ({ default: module.CoverSequence })),
)

export function SceneReel({ interruption }: { readonly interruption: number }) {
  const reduced = useReducedMotion()
  const interrupted = useRef(false)
  interrupted.current ||= reduced || interruption > 0
  if (reduced) return <StaticCover />
  return (
    <ContentBoundary fallback={<StaticCover />}>
      <Suspense fallback={<StaticCover />}>
        <Sequence interruption={interruption + Number(interrupted.current)} />
      </Suspense>
    </ContentBoundary>
  )
}
