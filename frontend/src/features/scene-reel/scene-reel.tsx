import { lazy, Suspense } from "react"
import { useReducedMotion } from "@/shared/motion"
import { ContentBoundary } from "@/shared/ui"
import { StaticCover } from "./static-cover"

const Reel = lazy(() => import("./proof-reel").then((module) => ({ default: module.ProofReel })))

export function SceneReel(_props: { readonly interruption: number }) {
  const reduced = useReducedMotion()
  return (
    <ContentBoundary fallback={<StaticCover />}>
      <Suspense fallback={<StaticCover />}>
        <Reel still={reduced} />
      </Suspense>
    </ContentBoundary>
  )
}
