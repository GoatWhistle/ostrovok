# Screen: Search workspace (hotels | map | chat)

Source of truth for the visual language: `work/design/system/` (Factmap design system).
Every value below is a token from `frontend/src/shared/styles/tokens/` and from `work/design/system/tokens.css`.
Brief from the team (2026-10-25): chat on the right, recommended hotels on the left; selecting a hotel
shows its card in the left panel. The map stays in the centre.

## Layout

| Width | Columns |
|---|---|
| ≥ 90rem | hotels `--workspace-panel` 400px, map `1fr`, chat `--workspace-chat` 400px |
| 64–90rem | hotels 360px, map `1fr`, chat 360px |
| < 64rem | one column, Segmented tabs Chat / Hotels / Map under the header, chat is the default tab |

- Full height: `calc(100dvh - var(--header-height))`; each column scrolls on its own (`ScrollArea`).
- Column separators are `box-shadow: inset ±1px 0 0 var(--border-subtle)` (hairline), never borders with colour.
- Panel ground: `--surface-base`; map column ground `--map-land`.

## Left panel: hotels

States:
1. Before the first search: `EmptyState` with the `building` icon, title "Здесь появятся отели",
   text "Опишите в чате, какой отель нужен. Подходящие отели появятся здесь, а на карте будет видно почему."
2. Loading: three skeleton hotel cards (thumb 84px square + 3 lines), appear after `--delay-skeleton`.
3. Results: header row, then the list.
   - Header row (`.scr-count` from the DS): `<b>N отелей</b> совпадают` on the left in body-sm,
     `Select` compact (sort: "По совпадению", "По названию") on the right.
   - List: DS `.hotel` card, sidebar variant: grid `84px 1fr`, gap `--space-16`, padding `--space-12`,
     `--radius-lg`, `--surface-raised`, `--shadow-ring`; selected = `--shadow-ring-selected`;
     hover (fine pointer) = `--shadow-ring-strong`; press scale `--press-scale-surface`.
     Thumb: `--radius-md`, `--map-land` ground, photo when available, otherwise `building` icon muted.
     Name: body bold, tracking tight. Score badge `.match-score`: lime `--surface-highlight` /
     `--text-on-highlight` when all matched, warning surface otherwise, icon check or partial + `3/3`.
     Meta row: caption muted, `pin` icon + address. Match list: rows `18px 1fr auto`, hue icon,
     label text-secondary caption, status glyph 16px (confirmed / partial / rejected / unknown / pending).
     Cards enter with `--motion-rise-in`, stagger `calc(var(--i) * var(--stagger))`, first load only.
4. Empty result: `EmptyState` `search` icon, "Таких отелей не нашлось", text pointing back to the chat.
5. Selected hotel: the list is replaced by the hotel card (same panel), with a top bar:
   ghost compact button `chevron-left` "Все отели" + hotel name. Swap uses `Swap` (fade + 4px shift).
   Fact details open inside the same panel with the same back pattern.

## Centre: map

DS map language: floating controls `--surface-overlay` + `--shadow-float`, `--radius-md`;
pins from the DS (white pill, lime check dot when complete, cobalt when selected). Sun/weather panel
uses DS `Select`, `Segmented`, `Card` styles. No custom control skins.

## Right panel: chat

Structure: header (title "Подбор" + ghost icon button "Новый поиск" with `retry`/`plus`), message log
(`role="log"`, `aria-live="polite"`), composer pinned to the bottom.

### Message: user
- Aligned to the end, max-inline-size 85%.
- `--action-primary` ground, `--text-on-action` text, body-sm, line-height body.
- Padding `--space-12 --space-16`, radius `--radius-lg` with end-end corner `--radius-xs`.
- Enters with `--motion-anchor-in` (scale 0.95 + 4px, origin bottom right).

### Message: agent
- Avatar: `BrandMark size="sm"` (still; `loading` while thinking) in a 32px tile `--radius-sm`, `--surface-sunken`.
- Bubble: `--surface-raised`, `--shadow-ring`, radius `--radius-lg` with start-end corner `--radius-xs`,
  padding `--space-12 --space-16`, gap `--space-12`, text body-sm `--text-primary`.
- Content blocks, in this order, each optional:
  1. Lead sentence, bold: "Нашёл 20 отелей." / "Пока не нашёл подходящих." / "Нужно уточнение."
  2. "Как я понял запрос": wrap of compact `Chip pressed` with hue + characteristic icon, one per intent.
  3. Corrections: DS `.banner` info (`--status-info-surface`, icon `info`), "«сочы» исправлено на «Сочи»".
  4. Unmatched terms: `StatusBadge tone="warning"` icon `unknown`: "Не нашёл в данных: зоопарк".
  5. Clarification: DS `.banner` warning + suggestion chips the user can tap to send.
  6. Unsupported region: banner neutral.
  7. Pending computation: `StatusBadge tone="info"` icon `pending` (shimmer).
  8. Actions: `Button variant="fact" size="compact" icon="map"` "Показать на карте" (lime, leads to the
     first matched hotel on the map) and ghost compact "Список отелей" on narrow screens.
- Thinking state: avatar `BrandMark` motion `loading`, bubble text "Ищу по фактам" + three skeleton
  lines (radius xs), shown after `--delay-skeleton`.
- Error state: bubble with `ErrorState` compact (icon tile, title, primary retry).
- Older agent messages keep a ghost compact button "Вернуть эту выдачу" that re-activates that search.

### Empty chat (first visit)
- Agent greeting bubble: "Опишите отель словами. Я найду, где это правда, и покажу на карте почему."
- Suggestion chips (DS first screen): "закат из окна" (sunset), "до моря пешком" (walk),
  "можно с собакой" (pets), "тихо ночью" (quiet). Tapping sends the query.
- BrandMark `enter` motion runs once per tab session on the greeting avatar.

### Composer
- DS `.hero-search` compact: `--surface-raised`, `--shadow-float`, radius `--radius-xl`,
  padding `--space-8 --space-8 --space-8 --space-16`, min-height `--control-height-hero`.
- Textarea auto-grows to 6 lines, body text, medium weight, placeholder muted.
- Send: `Button variant="primary" iconOnly icon="arrow-up"` compact, disabled when empty, `pending` while searching.
- Hint under the composer, caption muted: "Enter отправляет, Shift и Enter переносят строку".
- Focus: `--shadow-float, --shadow-ring-focus`.

## Motion
- New message: `--motion-anchor-in`; log scrolls to the newest message, not animated for keyboard input.
- Panel swap (list ↔ card): `Swap`.
- Everything respects reduced motion through the tokens.

## Copy rules
No em dashes, no arrows, no middle dots. RU default, EN mirror. All strings in `explore` namespace,
new keys under `explore:chat.*` and `explore:panel.*`.
