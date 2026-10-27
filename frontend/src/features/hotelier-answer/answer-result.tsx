import { useTranslation } from "@/shared/i18n"
import { Banner } from "@/shared/ui"
import styles from "./answer-result.module.css"

export interface FollowUpProps {
  readonly question: string | undefined
  readonly sent: string | undefined
}

export function FollowUp({ question, sent }: FollowUpProps) {
  const { t } = useTranslation()
  return (
    <div className={styles.result} data-follow-up>
      <Banner tone="info" title={t("explore:hotelier.followUp")}>
        {question ? <span lang="ru">{question}</span> : t("explore:hotelier.followUpText")}
      </Banner>
      {sent ? (
        <div className={styles.sent}>
          <p className={styles.label}>{t("explore:hotelier.previousAnswer")}</p>
          <p className={styles.text}>{sent}</p>
        </div>
      ) : null}
    </div>
  )
}
