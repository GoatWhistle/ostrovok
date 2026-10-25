import { clsx } from "clsx"
import type { CSSProperties } from "react"
import { characteristicHue, characteristicIcon, Icon } from "@/shared/ui"
import styles from "./fact-tile.module.css"

export type FactTileSize = "sm" | "md"

const SIZE: Readonly<Record<FactTileSize, string | undefined>> = {
  sm: styles.sm,
  md: styles.md,
}

export interface FactTileProps {
  readonly characteristicKey: string
  readonly size?: FactTileSize
}

export function hueStyle(characteristicKey: string): CSSProperties {
  return { "--hue": characteristicHue(characteristicKey) } as CSSProperties
}

export function FactTile({ characteristicKey, size = "md" }: FactTileProps) {
  return (
    <span className={clsx(styles.tile, SIZE[size])} style={hueStyle(characteristicKey)}>
      <Icon name={characteristicIcon(characteristicKey)} size={size === "sm" ? "sm" : "md"} />
    </span>
  )
}

export function HueIcon({ characteristicKey }: { readonly characteristicKey: string }) {
  return (
    <span className={styles.hueIcon} style={hueStyle(characteristicKey)}>
      <Icon name={characteristicIcon(characteristicKey)} size="sm" />
    </span>
  )
}
