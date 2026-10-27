import type { SearchResult } from "@/shared/api/hotel-types"
import { useTranslation } from "@/shared/i18n"
import { ErrorState, Skeleton } from "@/shared/ui"
import styles from "./agent-reply.module.css"
import { AgentBubble } from "./chat-bubble"
import {
  CityChoice,
  needsCity,
  ReplyActions,
  ReplyIntents,
  ReplyNotices,
  type SearchResponse,
} from "./reply-blocks"
import { useThinkingClock } from "./thinking-clock"

function leading(results: readonly SearchResult[]): SearchResult | undefined {
  return (
    results.find((result) =>
      result.matched.some((item) => item.match === "full" && item.geo_refs?.length),
    ) ?? results[0]
  )
}

export interface AgentReplyProps {
  readonly content: string
  readonly time?: string | undefined
  readonly search?: SearchResponse | undefined
  readonly onShowOnMap: (result: SearchResult | undefined) => void
  readonly onShowList: () => void
  readonly onSend: (message: string) => void
}

export function AgentReply({
  content,
  time,
  search,
  onShowOnMap,
  onShowList,
  onSend,
}: AgentReplyProps) {
  const asksCity = search ? needsCity(search.parsed) : false
  return (
    <AgentBubble time={time}>
      <p className={asksCity ? styles.question : styles.text}>{content}</p>
      {search ? (
        <>
          {asksCity ? <CityChoice onSend={onSend} /> : null}
          <ReplyIntents parsed={search.parsed} />
          <ReplyNotices parsed={search.parsed} pending={Boolean(search.pending?.length)} />
          {search.results.length ? (
            <ReplyActions
              leading={leading(search.results)}
              onShowOnMap={onShowOnMap}
              onShowList={onShowList}
            />
          ) : null}
        </>
      ) : null}
    </AgentBubble>
  )
}

export function AgentThinking() {
  const { t } = useTranslation()
  const elapsed = useThinkingClock()
  return (
    <AgentBubble motion="loading" busy>
      <p className={styles.lead} role="status">
        {t("explore:chat.thinking")}
      </p>
      <p className={styles.text}>{t("explore:chat.thinkingHint")}</p>
      <p className={styles.elapsed}>{t("explore:chat.elapsed", { value: elapsed })}</p>
      <Skeleton lines={3} className={styles.skeleton} />
    </AgentBubble>
  )
}

export function AgentFailure({ onRetry }: { readonly onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <AgentBubble>
      <ErrorState
        title={t("explore:chat.error")}
        description={t("explore:chat.errorText")}
        onRetry={onRetry}
        className={styles.error}
      />
    </AgentBubble>
  )
}
