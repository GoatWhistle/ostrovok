export interface SearchPreview {
  readonly id: string
  readonly name: string
  readonly location: readonly number[]
  readonly rating?: number | null
  readonly term?: string | null
  readonly route?: { readonly type: string; readonly coordinates: readonly number[][] } | null
  readonly meters?: number | null
  readonly minutes?: number | null
  readonly mode?: "graph" | "straight" | "onsite" | null
  readonly place_name?: string | null
  readonly place_location?: readonly number[] | null
  readonly place_id?: string | null
}
