import { type MessageKey, useTranslation } from "@/shared/i18n"
import { Button, Select } from "@/shared/ui"
import { DEFAULT_DIRECTION, type Order, type OrderKey } from "./result-order"
import styles from "./search-results.module.css"

const KEY_LABEL: Readonly<Record<OrderKey, MessageKey>> = {
  match: "explore:panel.sortMatch",
  rating: "explore:panel.sortRating",
  reviews: "explore:panel.sortReviews",
  sea: "explore:panel.sortSea",
  name: "explore:panel.sortName",
}

export interface SortControlProps {
  readonly order: Order
  readonly keys: readonly OrderKey[]
  readonly pending: boolean
  readonly onChange: (order: Order) => void
}

export function SortControl({ order, keys, pending, onChange }: SortControlProps) {
  const { t } = useTranslation()
  const ascending = order.direction === "asc"
  const directionLabel = t(
    ascending ? "explore:panel.sortAscending" : "explore:panel.sortDescending",
  )
  return (
    <div className={styles.sort} aria-busy={pending}>
      <Select<OrderKey>
        label={t("explore:panel.sort")}
        icon="sort"
        size="compact"
        value={order.key}
        onChange={(key) => onChange({ key, direction: DEFAULT_DIRECTION[key] })}
        options={keys.map((key) => ({ value: key, label: t(KEY_LABEL[key]) }))}
      />
      <Button
        variant="ghost"
        size="compact"
        iconOnly
        icon={ascending ? "sort-asc" : "sort-desc"}
        title={`${t("explore:panel.sortDirection")}: ${directionLabel}`}
        aria-label={`${t("explore:panel.sortDirection")}: ${directionLabel}`}
        onClick={() => onChange({ ...order, direction: ascending ? "desc" : "asc" })}
      >
        {directionLabel}
      </Button>
    </div>
  )
}
