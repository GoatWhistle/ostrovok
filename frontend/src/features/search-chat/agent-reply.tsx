import type { SearchResult } from "@/shared/api/hotel-types"
import { useTranslation } from "@/shared/i18n"
import { ErrorState, Skeleton } from "@/shared/ui"
import styles from "./agent-reply.module.css"
import { AgentBubble } from "./chat-bubble"
import { ReplyActions, ReplyIntents, ReplyNotices, type SearchResponse } from "./reply-blocks"

function leading(results: readonly SearchResult[]): SearchResult | undefined {
  return (
    results.find((result) =>
      result.matched.some((item) => item.match === "full" && item.geo_refs?.length),
    ) ?? results[0]
  )
}

export interface AgentReplyProps {
  readonly content: string
  readonly search?: SearchResponse | undefined
  readonly onShowOnMap: (result: SearchResult | undefined) => void
  readonly onShowList: () => void
}

export function AgentReply({ content, search, onShowOnMap, onShowList }: AgentReplyProps) {
  return (
    <AgentBubble>
      <p className={styles.text}>{content}</p>
      {search ? (
        <>
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
  return (
    <AgentBubble motion="loading" busy>
      <p className={styles.lead} role="status">
        {t("explore:chat.thinking")}
      </p>
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
