import { type FormEvent, useState } from "react"
import { useNavigate } from "react-router"
import { useTranslation } from "@/shared/i18n"
import { Button, TextField } from "@/shared/ui"
import styles from "./hotelier-header.module.css"

export function LookupForm({ hotelId }: { readonly hotelId: string | undefined }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [value, setValue] = useState(hotelId ?? "")
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (value.trim()) void navigate(`/hotelier/${encodeURIComponent(value.trim())}`)
  }
  return (
    <form className={styles.lookup} onSubmit={submit}>
      <TextField
        label={t("explore:hotelier.hotelId")}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        required
      />
      <Button icon="building" type="submit" variant="secondary" disabled={!value.trim()}>
        {t("explore:hotelier.open")}
      </Button>
    </form>
  )
}
