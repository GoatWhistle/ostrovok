import { Component, lazy, type ReactNode, Suspense, useRef } from "react"
import { useReducedMotion } from "@/shared/motion"
import { StaticCover } from "./static-cover"

const Sequence = lazy(() =>
  import("./cover-sequence").then((module) => ({ default: module.CoverSequence })),
)

class CoverBoundary extends Component<
  { readonly children: ReactNode },
  { readonly failed: boolean }
> {
  override state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  override render() {
    return this.state.failed ? <StaticCover /> : this.props.children
  }
}

export function SceneReel({ interruption }: { readonly interruption: number }) {
  const reduced = useReducedMotion()
  const interrupted = useRef(false)
  interrupted.current ||= reduced || interruption > 0
  if (reduced) return <StaticCover />
  return (
    <CoverBoundary>
      <Suspense fallback={<StaticCover />}>
        <Sequence interruption={interruption + Number(interrupted.current)} />
      </Suspense>
    </CoverBoundary>
  )
}
