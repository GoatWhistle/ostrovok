import type { useHotelWorkspace, WorkspaceView } from "@/features/hotel-search"
import { useTranslation } from "@/shared/i18n"
import { Segmented } from "@/shared/ui"
import styles from "./workspace-tabs.module.css"

const TAB_SURFACES: readonly string[] = ["workspace", "hotel-panel"]

export interface WorkspaceTabsProps {
  readonly surface: ReturnType<typeof useHotelWorkspace>["surface"]
  readonly value: WorkspaceView
  readonly onChange: (value: WorkspaceView) => void
}

export function WorkspaceTabs({ surface, value, onChange }: WorkspaceTabsProps) {
  const { t } = useTranslation()
  if (!TAB_SURFACES.includes(surface)) return null
  return (
    <nav className={styles.tabs} aria-label={t("explore:panel.tabs")}>
      <Segmented<WorkspaceView>
        label={t("explore:panel.tabs")}
        className={styles.bar}
        options={[
          { value: "chat", label: t("explore:panel.chat"), icon: "send" },
          { value: "hotels", label: t("explore:panel.hotels"), icon: "list" },
          { value: "map", label: t("explore:panel.map"), icon: "map" },
        ]}
        value={value}
        onChange={onChange}
      />
    </nav>
  )
}
