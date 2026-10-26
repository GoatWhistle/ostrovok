import { useLocation } from "react-router"
import { LocaleSwitch } from "@/features/locale-switch"
import { ThemeChoice } from "@/features/theme-switch"
import { useTranslation } from "@/shared/i18n"
import { ButtonLink, SettingsFooter, SettingsMenu, SettingsRow } from "@/shared/ui"

export function SiteSettings({ surface }: { readonly surface?: "plain" | "glass" }) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const onHotelier = pathname.startsWith("/hotelier")
  return (
    <SettingsMenu label={t("explore:landing.settings")} surface={surface ?? "plain"}>
      <SettingsRow label={t("explore:landing.language")}>
        <LocaleSwitch />
      </SettingsRow>
      <SettingsRow label={t("explore:landing.theme")}>
        <ThemeChoice />
      </SettingsRow>
      <SettingsFooter>
        {onHotelier ? (
          <ButtonLink to="/" variant="ghost" align="start" icon="search">
            {t("explore:navigation.search")}
          </ButtonLink>
        ) : (
          <ButtonLink to="/hotelier" variant="ghost" align="start" icon="hotelier">
            {t("explore:navigation.hotelier")}
          </ButtonLink>
        )}
      </SettingsFooter>
    </SettingsMenu>
  )
}
