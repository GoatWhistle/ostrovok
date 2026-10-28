import { RULES, type TreeRule } from "./scatter"

export interface TreePolicy {
  readonly rules: Readonly<Record<string, TreeRule>>
  readonly roadHalf: Readonly<Record<string, number>>
  readonly maskedGround: readonly string[]
  readonly maskWater: boolean
  readonly coastHalf: number
  readonly streetKinds: readonly string[]
  readonly streetStep: number
  readonly streetGap: number
  readonly streetRule: TreeRule
  readonly streetNeedsGround: boolean
  readonly osmRule: TreeRule
}

export const ROAD_HALF: Readonly<Record<string, number>> = {
  motorway: 10,
  trunk: 9,
  primary: 8,
  secondary: 7,
  tertiary: 6,
  residential: 4.5,
  unclassified: 4.5,
  living_street: 4,
  service: 3,
  pedestrian: 4,
  footway: 1.4,
  path: 1.4,
  cycleway: 1.6,
  steps: 1.4,
  track: 2,
}

export const TREE_POLICY: TreePolicy = {
  rules: RULES,
  roadHalf: ROAD_HALF,
  maskedGround: [
    "beach",
    "pitch",
    "parking",
    "pool",
    "construction",
    "pier",
    "industrial",
    "commercial",
    "farmland",
  ],
  maskWater: true,
  coastHalf: 10,
  streetKinds: ["residential", "living_street", "pedestrian"],
  streetStep: 16,
  streetGap: 2.4,
  streetRule: { spacing: 1, conifer: 0.06, bush: 0, keep: 0.6, height: [6, 10] },
  streetNeedsGround: true,
  osmRule: { spacing: 1, conifer: 0.1, bush: 0, keep: 1, height: [7, 12] },
}
