import type { Ref } from "react"
import { useTranslation } from "../../../i18n"
import { Button } from "./button"

export function CloseButton({
  onClick,
  label,
  ref,
}: {
  readonly onClick: () => void
  readonly label?: string
  readonly ref?: Ref<HTMLButtonElement>
}) {
  const { t } = useTranslation()
  const text = label ?? t("common:action.close")
  return (
    <Button ref={ref} variant="ghost" iconOnly icon="close" title={text} onClick={onClick}>
      {text}
    </Button>
  )
}
