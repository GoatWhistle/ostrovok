import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api, unwrap } from "@/shared/api"
export function useHotelierQuestions(id: string | undefined) {
  return useQuery({
    queryKey: ["questions", id],
    enabled: id !== undefined,
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/hotelier/{hotel_id}/questions", {
          signal,
          params: { path: { hotel_id: id ?? "" } },
        }),
      ),
    retry: false,
  })
}
export function useHotelierAnswer() {
  const cache = useQueryClient()
  return useMutation({
    mutationFn: ({ questionId, text }: { readonly questionId: string; readonly text: string }) =>
      unwrap(
        api.POST("/hotelier/questions/{question_id}/answer", {
          params: { path: { question_id: questionId } },
          body: { text },
        }),
      ),
    onSuccess: async () => {
      await Promise.all(
        ["questions", "hotel", "fact", "search", "scene", "geometry"].map((key) =>
          cache.invalidateQueries({ queryKey: [key] }),
        ),
      )
    },
  })
}
