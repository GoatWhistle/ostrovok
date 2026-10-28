import type { components } from "@/shared/api/schema.gen"
import { useTranslation } from "@/shared/i18n"
import styles from "./conflict-values.module.css"

type Conflict = components["schemas"]["Conflict"]
type Fact = components["schemas"]["Fact"]

export interface ConflictValuesProps {
  readonly conflicts: readonly Conflict[]
  readonly facts: readonly Fact[]
}

type Side = "accepted" | "rejected"

const SIDE_CLASS: Record<Side, string | undefined> = {
  accepted: styles.accepted,
  rejected: styles.rejected,
}

const SIDE_LABEL: Record<
  Side,
  "explore:details.conflict.accepted" | "explore:details.conflict.rejected"
> = {
  accepted: "explore:details.conflict.accepted",
  rejected: "explore:details.conflict.rejected",
}

function sideOf(fact: Fact, winner: string | null | undefined): Side {
  return fact.fact_id === winner ? "accepted" : "rejected"
}

export function ConflictValues({ conflicts, facts }: ConflictValuesProps) {
  const { t } = useTranslation()
  return (
    <ul className={styles.list}>
      {conflicts.map((conflict) => (
        <li className={styles.row} key={conflict.id}>
          {facts
            .filter((fact) => conflict.fact_ids.includes(fact.fact_id))
            .map((fact) => {
              const side = sideOf(fact, conflict.winner_fact_id)
              return (
                <span className={SIDE_CLASS[side]} key={fact.fact_id}>
                  {t(SIDE_LABEL[side])}
                  {": "}
                  {fact.label}
                </span>
              )
            })}
        </li>
      ))}
    </ul>
  )
}
