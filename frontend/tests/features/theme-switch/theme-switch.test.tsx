import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { ThemeSwitch } from "@/features/theme-switch"
import { createI18n, LocaleProvider } from "@/shared/i18n"
import ru from "@/shared/i18n/locales/ru/common.json"
import { THEME_STORAGE_KEY, ThemeProvider } from "@/shared/theme"

function renderSwitch() {
  return render(
    <LocaleProvider instance={createI18n("ru")}>
      <ThemeProvider>
        <ThemeSwitch />
      </ThemeProvider>
    </LocaleProvider>,
  )
}

describe("ThemeSwitch", () => {
  it("follows the system theme until a choice is made, without a system option", () => {
    renderSwitch()
    expect(screen.getAllByRole("button")).toHaveLength(1)
    expect(screen.getByRole("button", { name: ru.theme.dark })).toBeTruthy()
    expect(document.documentElement.dataset.theme).toBe("light")
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })

  it("applies and stores the chosen theme", async () => {
    renderSwitch()
    await userEvent.click(screen.getByRole("button", { name: ru.theme.dark }))
    expect(document.documentElement.dataset.theme).toBe("dark")
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark")
    expect(screen.getByRole("button", { name: ru.theme.light })).toBeTruthy()
  })

  it("restores the stored choice", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark")
    renderSwitch()
    expect(screen.getByRole("button", { name: ru.theme.light })).toBeTruthy()
    expect(document.documentElement.dataset.theme).toBe("dark")
  })
})
