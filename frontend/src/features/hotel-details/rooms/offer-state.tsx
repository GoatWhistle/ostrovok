import { type MessageKey, useTranslation } from "@/shared/i18n"
import { Banner, Button, Skeleton } from "@/shared/ui"

export interface OfferRequest {
  readonly pending: boolean
  readonly failed: boolean
  readonly fetching: boolean
  readonly retry: () => void
}

export interface QueryState {
  readonly isPending: boolean
  readonly isError: boolean
  readonly isFetching: boolean
  readonly refetch: () => unknown
}

export function offerRequest(
  offers: QueryState,
  catalog: QueryState,
  dated: boolean,
): OfferRequest {
  return {
    pending: (offers.isPending && dated) || catalog.isPending,
    failed: offers.isError || catalog.isError,
    fetching: offers.isFetching || catalog.isFetching,
    retry: () => {
      void offers.refetch()
      void catalog.refetch()
    },
  }
}

export function OfferState({
  request,
  status,
  sandbox,
  partial,
}: {
  readonly request: OfferRequest
  readonly status: MessageKey | undefined
  readonly sandbox: boolean
  readonly partial: boolean
}) {
  const { t } = useTranslation()
  return (
    <>
      {request.pending ? <Skeleton shape="block" /> : null}
      {request.failed ? <Banner tone="danger" title={t("explore:offers.requestError")} /> : null}
      {request.failed || status === "explore:offers.providerError" ? (
        <Button
          variant="secondary"
          size="compact"
          onClick={request.retry}
          disabled={request.fetching}
        >
          {t("common:action.retry")}
        </Button>
      ) : null}
      {sandbox ? <Banner tone="neutral" title={t("explore:offers.sandbox")} /> : null}
      {status ? <Banner tone="neutral" title={t(status)} /> : null}
      {partial ? <Banner tone="neutral" title={t("explore:rooms.partial")} /> : null}
    </>
  )
}
