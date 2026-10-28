import { useState } from "react"
import { useCharacteristics } from "@/entities/catalog"
import { useHotel } from "@/entities/hotel"
import { useHotelierQuestions } from "@/entities/hotelier"
import { useTranslation } from "@/shared/i18n"
import { Card, ErrorState, Skeleton, Tabs } from "@/shared/ui"
import { HotelierData } from "./hotelier-data"
import { HotelierQuestions } from "./hotelier-questions"
import styles from "./hotelier-workspace.module.css"

export interface HotelierWorkspaceProps {
  readonly hotelId: string
}

export function HotelierWorkspace({ hotelId }: HotelierWorkspaceProps) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<"questions" | "data">("questions")
  const questions = useHotelierQuestions(hotelId)
  const catalog = useCharacteristics()
  const hotel = useHotel(hotelId)
  const editable = new Set(
    catalog.data?.items
      ?.filter((item) => item.scope === "hotel" && item.source_kinds?.includes("hotelier"))
      .map((item) => item.key),
  )
  const items = (questions.data?.items ?? []).filter((q) => editable.has(q.characteristic_key))
  const pending = items.filter((q) => q.status !== "answered")
  const failure = [questions, catalog, hotel].find((query) => query.isError)
  return (
    <section className={styles.workspace}>
      <Tabs
        label={t("explore:workspace.tabs")}
        value={tab}
        onChange={setTab}
        options={[
          {
            value: "questions",
            label: t("explore:workspace.questions"),
            icon: "list",
            count: pending.length,
          },
          { value: "data", label: t("explore:workspace.data"), icon: "edit" },
        ]}
      />
      {failure ? (
        <ErrorState
          title={t("explore:workspace.loadFailed")}
          onRetry={() => void failure.refetch()}
          retryPending={failure.isFetching}
        />
      ) : null}
      {!failure && (questions.isPending || catalog.isPending || hotel.isPending) ? (
        <Skeleton lines={6} />
      ) : null}
      {!failure && questions.isSuccess && catalog.isSuccess && hotel.data ? (
        <>
          <div
            role="tabpanel"
            aria-label={t("explore:workspace.questions")}
            hidden={tab !== "questions"}
          >
            <Card
              className={styles.heading}
              title={
                <span className={styles.headingText}>
                  {t("explore:workspace.questionsHeading")}
                </span>
              }
            >
              <HotelierQuestions
                hotelId={hotelId}
                questions={pending}
                onData={() => setTab("data")}
              />
            </Card>
          </div>
          <div role="tabpanel" aria-label={t("explore:workspace.data")} hidden={tab !== "data"}>
            {tab === "data" ? (
              <HotelierData hotelId={hotelId} questions={items} facts={hotel.data.facts ?? []} />
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  )
}
