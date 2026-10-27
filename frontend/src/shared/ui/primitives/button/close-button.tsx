import type { Ref } from "react"
import { useTranslation } from "../../../i18n"
import { Button, type ButtonSize } from "./button"

export function CloseButton({
  onClick,
  label,
  ref,
  size = "regular",
}: {
  readonly onClick: () => void
  readonly label?: string
  readonly ref?: Ref<HTMLButtonElement>
  readonly size?: ButtonSize
}) {
  const { t } = useTranslation()
  const text = label ?? t("common:action.close")
  return (
    <Button
      ref={ref}
      variant="ghost"
      size={size}
      iconOnly
      icon="close"
      title={text}
      onClick={onClick}
    >
      {text}
    </Button>
  )
}
