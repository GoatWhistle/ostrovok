import { LocaleSwitch } from "@/features/locale-switch"
import { ThemeChoice } from "@/features/theme-switch"
import { useTranslation } from "@/shared/i18n"
import { ButtonLink, SettingsFooter, SettingsMenu, SettingsRow } from "@/shared/ui"

export function LandingSettings() {
  const { t } = useTranslation()
  return (
    <SettingsMenu label={t("explore:landing.settings")} surface="glass">
      <SettingsRow label={t("explore:landing.language")}>
        <LocaleSwitch />
      </SettingsRow>
      <SettingsRow label={t("explore:landing.theme")}>
        <ThemeChoice />
      </SettingsRow>
      <SettingsFooter>
        <ButtonLink to="/hotelier" variant="ghost" align="start" icon="hotelier">
          {t("explore:navigation.hotelier")}
        </ButtonLink>
      </SettingsFooter>
    </SettingsMenu>
  )
}
