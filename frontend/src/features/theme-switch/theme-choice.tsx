import { useTranslation } from "@/shared/i18n"
import { revealTransition } from "@/shared/motion"
import { type Theme, useTheme } from "@/shared/theme"
import { Segmented, type SegmentedOption } from "@/shared/ui"

export function ThemeChoice() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const options: SegmentedOption<Theme>[] = [
    { value: "light", label: t("common:theme.lightName"), icon: "theme-light" },
    { value: "dark", label: t("common:theme.darkName"), icon: "theme-dark" },
  ]
  return (
    <Segmented
      label={t("common:theme.legend")}
      options={options}
      value={theme}
      display="icon"
      onChange={(next) => void revealTransition("theme", () => setTheme(next))}
    />
  )
}
