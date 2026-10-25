import { flushSync } from "react-dom"
import { useTranslation } from "@/shared/i18n"
import { revealTransition } from "@/shared/motion"
import { type Theme, useTheme } from "@/shared/theme"
import { Button } from "@/shared/ui"

export function ThemeSwitch() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const next: Theme = theme === "dark" ? "light" : "dark"
  return (
    <Button
      variant="ghost"
      iconOnly
      icon={theme === "dark" ? "theme-dark" : "theme-light"}
      title={t(`common:theme.${next}`)}
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect()
        void revealTransition(
          "theme",
          () => flushSync(() => setTheme(next)),
          { x: box.left + box.width / 2, y: box.top + box.height / 2 },
          event.detail === 0,
        )
      }}
    >
      {t(`common:theme.${next}`)}
    </Button>
  )
}
