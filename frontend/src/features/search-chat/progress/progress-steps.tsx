import { type MessageKey, useTranslation } from "@/shared/i18n"
import styles from "./agent-progress.module.css"
import { STEPS, type StepId } from "./progress-view"

export const STEP_LABEL: Readonly<Record<StepId, MessageKey>> = {
  parse: "explore:chat.progress.step.parse",
  hotels: "explore:chat.progress.step.hotels",
  wishes: "explore:chat.progress.step.wishes",
  answer: "explore:chat.progress.step.answer",
}

type StepState = "done" | "current" | "todo"

const STATE_LABEL: Readonly<Record<StepState, MessageKey>> = {
  done: "explore:chat.progress.stepState.done",
  current: "explore:chat.progress.stepState.current",
  todo: "explore:chat.progress.stepState.todo",
}

function stateOf(index: number, current: number): StepState {
  if (index < current) return "done"
  return index === current ? "current" : "todo"
}

export function ProgressSteps({ current }: { readonly current: number }) {
  const { t } = useTranslation()
  return (
    <ol className={styles.steps} aria-label={t("explore:chat.progress.steps")}>
      {STEPS.map((step, index) => {
        const state = stateOf(index, current)
        return (
          <li key={step} className={styles.step} data-state={state}>
            <span className="visually-hidden">
              {t("explore:chat.progress.stepAria", {
                step: t(STEP_LABEL[step]),
                state: t(STATE_LABEL[state]),
              })}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
