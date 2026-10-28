import { QueryClient } from "@tanstack/react-query"

const base = {
  description: "",
  scope: "hotel" as const,
  source_kinds: ["hotelier" as const],
  unit: null,
  display: {},
}

export const CHARACTERISTICS = {
  items: [
    {
      ...base,
      key: "double_room",
      title: "Double room",
      value_type: "bool" as const,
      answer_fields: [{ name: "present", kind: "bool" as const, unit: null }],
    },
    {
      ...base,
      key: "pets_policy",
      title: "Pets",
      value_type: "object" as const,
      answer_fields: [
        { name: "allowed", kind: "bool" as const, unit: null },
        { name: "max_weight_kg", kind: "number" as const, unit: "kg" },
        { name: "fee_rub", kind: "number" as const, unit: "₽" },
      ],
    },
    {
      ...base,
      key: "room_capacity",
      title: "Capacity",
      value_type: "number" as const,
      answer_fields: [{ name: "adults", kind: "number" as const, unit: "adults" }],
    },
  ],
}

export function registryClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  })
  client.setQueryData(["characteristics"], CHARACTERISTICS)
  return client
}
