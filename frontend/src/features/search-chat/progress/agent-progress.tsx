import type { ChatProgress } from "@/shared/api"
import { useTranslation } from "@/shared/i18n"
import { Skeleton } from "@/shared/ui"
import { AgentBubble } from "../chat-bubble"
import { useThinkingClock } from "../thinking-clock"
import styles from "./agent-progress.module.css"
import { ProgressSteps, STEP_LABEL } from "./progress-steps"
import { progressView, STEPS } from "./progress-view"
import { UnderstoodChips } from "./understood-chips"

const STAGE_KEYS = {
  parsing: "explore:chat.stage.parsing",
  candidates: "explore:chat.stage.candidates",
  research: "explore:chat.stage.research",
  wish: "explore:chat.stage.wish",
  review: "explore:chat.stage.review",
} as const

type Stage = keyof typeof STAGE_KEYS

function isStage(value: string): value is Stage {
  return value in STAGE_KEYS
}

export function AgentProgress({ events }: { readonly events: readonly ChatProgress[] }) {
  const { t } = useTranslation()
  const elapsed = useThinkingClock()
  const view = progressView(events)
  const step = STEPS[view.step] ?? "parse"
  const latest = events.findLast((event) => isStage(event.stage))
  const detail =
    latest && isStage(latest.stage)
      ? t(STAGE_KEYS[latest.stage], { ...latest })
      : t("explore:chat.thinkingHint")
  const understood = view.wishes.length > 0 || view.location !== undefined
  return (
    <AgentBubble motion="loading" busy>
      <div className={styles.progress}>
        <div className={styles.head}>
          <p className={styles.lead} role="status">
            {t(STEP_LABEL[step])}
          </p>
          <p className={styles.elapsed}>
            <span className="visually-hidden">{t("explore:chat.elapsed", { value: elapsed })}</span>
            <span aria-hidden="true">{elapsed}</span>
          </p>
        </div>
        <ProgressSteps current={view.step} />
        <p className={styles.detail} aria-live="polite">
          {detail}
        </p>
        {understood ? (
          <UnderstoodChips view={view} />
        ) : (
          <Skeleton lines={2} className={styles.skeleton} />
        )}
      </div>
    </AgentBubble>
  )
}
