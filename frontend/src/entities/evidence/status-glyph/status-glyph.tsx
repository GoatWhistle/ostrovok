import { clsx } from "clsx"
import type { FactBrief, MatchedProperty } from "@/shared/api/hotel-types"
import { useTranslation } from "@/shared/i18n"
import { Icon, type IconName, StatusBadge, type StatusTone } from "@/shared/ui"
import styles from "./status-glyph.module.css"

type Match = MatchedProperty["match"]
type FactStatus = FactBrief["status"]
type SourceType = FactBrief["source_type"]
type GlyphTone = "ok" | "part" | "no" | "conflict" | "muted"

const TONE: Readonly<Record<GlyphTone, string | undefined>> = {
  ok: styles.ok,
  part: styles.part,
  no: styles.no,
  conflict: styles.conflict,
  muted: styles.muted,
}

const MATCH_GLYPH: Readonly<Record<Match, readonly [IconName, GlyphTone]>> = {
  full: ["success", "ok"],
  partial: ["partial", "part"],
  none: ["rejected", "no"],
  unknown: ["unknown", "muted"],
  computing: ["pending", "muted"],
}

const STATUS_GLYPH: Readonly<Record<FactStatus, readonly [IconName, GlyphTone]>> = {
  active: ["success", "ok"],
  confirmed_by_hotelier: ["verified", "ok"],
  conflicted: ["alert", "conflict"],
  stale: ["stale", "muted"],
  superseded: ["stale", "muted"],
  computing: ["pending", "muted"],
}

const STATUS_BADGE: Readonly<Record<FactStatus, readonly [StatusTone, IconName] | null>> = {
  active: null,
  confirmed_by_hotelier: ["success", "verified"],
  conflicted: ["conflict", "alert"],
  stale: ["stale", "stale"],
  superseded: ["stale", "stale"],
  computing: ["info", "pending"],
}

const SOURCE_ICON: Readonly<Record<SourceType, IconName>> = {
  hotelier: "hotelier",
  osm: "osm",
  dem: "computed",
  computed: "computed",
  open_meteo: "computed",
  llm_extraction: "source",
}

function Glyph({ icon, tone, label }: { icon: IconName; tone: GlyphTone; label: string }) {
  return (
    <span className={clsx(styles.glyph, TONE[tone])}>
      <Icon name={icon} size="sm" label={label} />
    </span>
  )
}

export function MatchGlyph({ match }: { readonly match: Match }) {
  const { t } = useTranslation()
  const [icon, tone] = MATCH_GLYPH[match]
  return <Glyph icon={icon} tone={tone} label={t(`explore:match.${match}`)} />
}

export function StatusGlyph({ status }: { readonly status: FactStatus }) {
  const { t } = useTranslation()
  const [icon, tone] = STATUS_GLYPH[status]
  return <Glyph icon={icon} tone={tone} label={t(`explore:status.${status}`)} />
}

export function FactStatusBadge({ status }: { readonly status: FactStatus }) {
  const { t } = useTranslation()
  const badge = STATUS_BADGE[status]
  if (!badge) return null
  return (
    <StatusBadge tone={badge[0]} icon={badge[1]}>
      {t(`explore:status.${status}`)}
    </StatusBadge>
  )
}

export function SourceBadge({ source }: { readonly source: SourceType }) {
  const { t } = useTranslation()
  return (
    <StatusBadge tone={source === "hotelier" ? "success" : "neutral"} icon={SOURCE_ICON[source]}>
      {t(`explore:source.${source}`)}
    </StatusBadge>
  )
}

export function sourceIcon(source: SourceType): IconName {
  return SOURCE_ICON[source]
}
