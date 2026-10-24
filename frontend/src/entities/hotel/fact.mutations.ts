import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api, unwrap } from "@/shared/api"
export function useFactMutation(factId: string) {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      readonly action: "confirm" | "correct"
      readonly value?: unknown
      readonly comment?: string
    }) =>
      input.action === "confirm"
        ? unwrap(api.POST("/facts/{fact_id}/confirm", { params: { path: { fact_id: factId } } }))
        : unwrap(
            api.POST("/facts/{fact_id}/correct", {
              params: { path: { fact_id: factId } },
              body: { value: input.value, ...(input.comment ? { comment: input.comment } : {}) },
            }),
          ),
    onSuccess: async () => {
      await Promise.all(
        ["hotel", "fact", "search", "scene", "geometry"].map((key) =>
          cache.invalidateQueries({ queryKey: [key] }),
        ),
      )
    },
  })
}
