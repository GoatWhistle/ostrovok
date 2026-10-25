import { type FormEvent, useState } from "react"
import { useCharacteristics, useRegions } from "@/entities/catalog"
import type { SearchRequest } from "@/shared/api/hotel-types"
import { characteristicTitle } from "@/shared/geo/fact-label"
import { useLocale, useTranslation } from "@/shared/i18n"
import { Button, Icon, Skeleton, TextArea } from "@/shared/ui"
import { characteristicIcon } from "@/shared/ui/primitives/icon/characteristic-icon"
import styles from "./hotel-search.module.css"
export interface HotelSearchProps {
  readonly onSearch: (request: SearchRequest) => void
  readonly pending: boolean
}
export function HotelSearch({ onSearch, pending }: HotelSearchProps) {
  const { t } = useTranslation()
  const { locale } = useLocale()
  const [query, setQuery] = useState("")
  const [region, setRegion] = useState("")
  const characteristics = useCharacteristics()
  const regions = useRegions()
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (query.trim())
      onSearch({ query: query.trim(), region_id: region || null, compute_missing: true, limit: 20 })
  }
  return (
    <section className={styles.search} aria-label={t("explore:search.label")}>
      <div className={styles.intro}>
        <h1 className={styles.title}>{t("explore:title")}</h1>
        <p className={styles.subtitle}>{t("explore:subtitle")}</p>
      </div>
      <form className={styles.form} onSubmit={submit}>
        <TextArea
          label={t("explore:search.label")}
          placeholder={t("explore:search.placeholder")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={2000}
          required
        />
        {(regions.data?.items?.length ?? 0) > 0 ? (
          <fieldset className={styles.regions}>
            <legend className="visually-hidden">{t("explore:search.region")}</legend>
            <Button
              variant={region === "" ? "primary" : "secondary"}
              onClick={() => setRegion("")}
              aria-pressed={region === ""}
              icon="pin"
            >
              {t("explore:search.allRegions")}
            </Button>
            {regions.data?.items
              ?.filter((item) => item.id)
              .map((item) => (
                <Button
                  key={item.id}
                  variant={region === item.id ? "primary" : "secondary"}
                  onClick={() => setRegion(item.id ?? "")}
                  aria-pressed={region === item.id}
                  icon="pin"
                >
                  {item.name}
                </Button>
              ))}
          </fieldset>
        ) : null}
        {regions.isError ? (
          <p className={styles.note}>{t("explore:search.regionUnavailable")}</p>
        ) : null}
        <Button type="submit" icon="search" pending={pending} disabled={!query.trim()}>
          {t("explore:search.submit")}
        </Button>
      </form>
      <div className={styles.traits}>
        <p className={styles.legend}>{t("explore:search.traits")}</p>
        {characteristics.isPending ? <Skeleton /> : null}
        {characteristics.isError ? (
          <Button variant="ghost" icon="retry" onClick={() => void characteristics.refetch()}>
            {t("explore:search.traitError")}
          </Button>
        ) : null}
        <div className={styles.chips}>
          {characteristics.data?.items?.map((item) => (
            <Button
              key={item.key}
              variant="secondary"
              icon={characteristicIcon(item.key)}
              onClick={() =>
                setQuery((current) =>
                  current.trim()
                    ? `${current.trim()}, ${characteristicTitle(item.key, locale).toLocaleLowerCase()}`
                    : characteristicTitle(item.key, locale),
                )
              }
            >
              {characteristicTitle(item.key, locale)}
            </Button>
          ))}
        </div>
      </div>
      <p className={styles.proof}>
        <Icon name="verified" size="sm" />
        {t("explore:service.facts")}
      </p>
    </section>
  )
}
