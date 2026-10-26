import { useQueryClient } from "@tanstack/react-query"
import { api, unwrap, useRecordMutation } from "@/shared/api"
import { clearSessionDraft } from "@/shared/hooks"
export function useFactMutation(factId: string) {
  const cache = useQueryClient()
  return useRecordMutation(["fact-write", factId], {
    mutationFn: (input: {
      readonly action: "confirm" | "correct"
      readonly value?: unknown
      readonly comment?: string
      readonly draft?: string
    }) =>
      input.action === "confirm"
        ? unwrap(api.POST("/facts/{fact_id}/confirm", { params: { path: { fact_id: factId } } }))
        : unwrap(
            api.POST("/facts/{fact_id}/correct", {
              params: { path: { fact_id: factId } },
              body: { value: input.value, ...(input.comment ? { comment: input.comment } : {}) },
            }),
          ),
    onSuccess: async (_data, input) => {
      if (input.draft !== undefined) clearSessionDraft(`fact:${factId}`, input.draft)
      await Promise.all(
        ["hotel", "fact", "questions", "search", "compare", "scene", "geometry"].map((key) =>
          cache.invalidateQueries({ queryKey: [key] }),
        ),
      )
    },
  })
}
