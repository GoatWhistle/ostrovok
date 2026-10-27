import { useQuery, useQueryClient } from "@tanstack/react-query"
import { api, unwrap, useRecordMutation } from "@/shared/api"
import { clearSessionDraft } from "@/shared/hooks"
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
export function useHotelierAnswer(hotelId: string, questionId: string) {
  const cache = useQueryClient()
  return useRecordMutation(
    ["question-write", questionId, "answer"],
    {
      mutationFn: ({ text }: { readonly text: string; readonly draft: string }) =>
        unwrap(
          api.POST("/hotelier/questions/{question_id}/answer", {
            params: { path: { question_id: questionId } },
            body: { text },
          }),
        ),
      onSuccess: async (data, input) => {
        if (!data.follow_up && data.extracted?.length) {
          clearSessionDraft(`question:${hotelId}:${questionId}`, input.draft)
        }
        await Promise.all(
          ["questions", "hotel", "fact", "search", "compare", "scene", "geometry"].map((key) =>
            cache.invalidateQueries({ queryKey: [key] }),
          ),
        )
      },
    },
    ["question-write", questionId],
  )
}
export function useQuestionStatus(questionId: string) {
  const cache = useQueryClient()
  return useRecordMutation(
    ["question-write", questionId, "status"],
    {
      mutationFn: (status: "open" | "skipped") =>
        unwrap(
          api.PATCH("/hotelier/questions/{question_id}", {
            params: { path: { question_id: questionId } },
            body: { status },
          }),
        ),
      onSettled: () => cache.invalidateQueries({ queryKey: ["questions"] }),
    },
    ["question-write", questionId],
  )
}
