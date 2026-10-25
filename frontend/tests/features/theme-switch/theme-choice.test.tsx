import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { ThemeChoice } from "@/features/theme-switch"
import { createI18n, LocaleProvider } from "@/shared/i18n"
import ru from "@/shared/i18n/locales/ru/common.json"
import { THEME_STORAGE_KEY, ThemeProvider } from "@/shared/theme"

function renderChoice() {
  return render(
    <LocaleProvider instance={createI18n("ru")}>
      <ThemeProvider>
        <ThemeChoice />
      </ThemeProvider>
    </LocaleProvider>,
  )
}

describe("ThemeChoice", () => {
  it("follows the system theme until a choice is made, without a system option", () => {
    renderChoice()
    expect(screen.getAllByRole("radio")).toHaveLength(2)
    expect(screen.getByRole("radio", { name: ru.theme.lightName })).toHaveProperty("checked", true)
    expect(document.documentElement.dataset.theme).toBe("light")
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })

  it("applies and stores the chosen theme", async () => {
    renderChoice()
    await userEvent.click(screen.getByRole("radio", { name: ru.theme.darkName }))
    expect(document.documentElement.dataset.theme).toBe("dark")
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark")
  })

  it("restores the stored choice", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark")
    renderChoice()
    expect(screen.getByRole("radio", { name: ru.theme.darkName })).toHaveProperty("checked", true)
    expect(document.documentElement.dataset.theme).toBe("dark")
  })
})
