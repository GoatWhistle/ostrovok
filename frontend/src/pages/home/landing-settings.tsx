import { useEffect, useId, useRef, useState } from "react"
import { LocaleSwitch } from "@/features/locale-switch"
import { ThemeChoice } from "@/features/theme-switch"
import { useTranslation } from "@/shared/i18n"
import { usePresence } from "@/shared/motion"
import { Button, ButtonLink } from "@/shared/ui"
import styles from "./landing-settings.module.css"

export function LandingSettings() {
  const { t } = useTranslation()
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const presence = usePresence(open)
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", close)
    document.addEventListener("keydown", dismiss)
    return () => {
      document.removeEventListener("pointerdown", close)
      document.removeEventListener("keydown", dismiss)
    }
  }, [open])
  return (
    <div ref={root} className={styles.root}>
      <Button
        variant="ghost"
        iconOnly
        icon="settings"
        aria-expanded={open}
        aria-controls={id}
        className={styles.trigger}
        onClick={() => setOpen((current) => !current)}
      >
        {t("explore:landing.settings")}
      </Button>
      {presence.mounted ? (
        <section
          id={id}
          className={styles.panel}
          aria-label={t("explore:landing.settings")}
          data-state={presence.state}
          onAnimationEnd={presence.onAnimationEnd}
        >
          <div className={styles.row}>
            <p className={styles.label}>{t("explore:landing.language")}</p>
            <LocaleSwitch />
          </div>
          <div className={styles.row}>
            <p className={styles.label}>{t("explore:landing.theme")}</p>
            <ThemeChoice />
          </div>
          <div className={styles.footer}>
            <ButtonLink
              to="/hotelier"
              variant="ghost"
              align="start"
              icon="hotelier"
              className={styles.link}
            >
              {t("explore:navigation.hotelier")}
            </ButtonLink>
          </div>
        </section>
      ) : null}
    </div>
  )
}
