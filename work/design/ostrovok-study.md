# Ostrovok.ru visual language study

Source: live site https://ostrovok.ru/, inspected 2026-10-25 with Playwright (Chromium, isolated
context, `ru-RU`, Europe/Moscow). Desktop 1440x900, mobile 375x812 (iPhone UA, DPR 2).
Method: `getComputedStyle` on live elements, CSS custom properties from inline theme sheets, and the
first-party CSS bundles (`mpf.fastrovok.net`, `hf.fastrovok.net`, downloaded with curl because they
are cross-origin to `document.styleSheets`). Pixel colours of map tiles/favicon were sampled from
screenshots. No automation block was hit; the site shows a third-party Flocktory promo modal and a
cookie banner on first visit, and an app-install bottom sheet on mobile. These were captured, then
dismissed or removed for clean shots.

Pages:
- Home: `https://ostrovok.ru/`
- Search results (SERP): `https://ostrovok.ru/hotel/russia/sochi/?dates=25.11.2026-28.11.2026&guests=2&search=yes&q=5580`
  (reached through the real search form: Сочи, Россия; 25–28 Nov 2026; 2 guests)
- Hotel: `https://ostrovok.ru/hotel/russia/sochi/mid13429040/hotel_azimut_park_hotel_plyus_rezidens_sochi/?dates=25.11.2026-28.11.2026&guests=2&q=5580`

Stack observed: Next.js, CSS Modules (`Component_class__hash`), a token layer in CSS variables on
`body` (`--palette-*`, `--p-*`, `--t-*`), marketing-page tokens `--mpf-*`, react-select for the sort
dropdown, Leaflet for maps.

## 1. Colour

### 1.1 Brand and interactive

| Role | Value | Token / where |
|---|---|---|
| Primary brand (cobalt) | `#0E41D2` | `--palette-main`, `--p-brand`, `--button-primary-bg`, `--link`; logo, CTA buttons, links, selected dates, tooltip bubble, header icons, slider thumbs |
| Primary hover | `#0636C8` (rgb 6,54,200) | `--p-primary-hover`, `--field-hover-border` |
| Primary active | `#0017B0` (rgb 0,23,176) | `--p-primary-active`, `--link-hover` (legacy) |
| Link hover (new tokens) | `#2A63F5` | `--p-link-hover`, ghost button hover |
| Link on dark | `#92BCFF` / hover `#BCDDFF` | `--p-link-inv`, `--link-alt` |
| Accent lime | `#ADEF81` computed (`--mpf-color-accent-green: #acef81`) | Home header and hero background, favicon tile, 40px overlapping sheet sits on it |
| Secondary button bg (legacy) | `#E3EBFD` | `--palette-sec`, `--button-secondary-bg`; SERP active tab fill, "Зарегистрировать объект" pill |
| Secondary button bg (new) | `#EDF2FC` hover `#EAEFF9` active `#E6EBF5` | `--t-button-secondary-*`; "Читать все отзывы", "Изменить", gallery arrows |
| Secondary label | `#0E41D2` | |
| Header secondary | `#B4CBF9` | `--header-secondary` |
| Header typo | `#1948C4` | `--header-typo` |
| Focus ring | `rgba(14,65,210,0.4)` as `0 0 0 2px` | `--focus-outline`, `--p-focus` |
| Selected row / option | `rgba(14,65,210,0.1)` | `--dropdown-selected-bg`, suggest active row |
| Highlight | `#EEF9FF` | `--p-highlight` |
| Other marketing blues | `#0A4FEC`, `#0236C7`, `#184CDC`, border `#ABC1FF`, light bg `#EAF2FF` | `--mpf-color-accent-blue*` |

### 1.2 Loyalty "ГУРУ" layer

| Role | Value |
|---|---|
| GURU gradient (logo sparkle, pins, badges) | `#4225F2` → `#0460EA` |
| GURU price text on map | `#0460EA`, guru price `#322EF6` |
| GURU benefit strip / ticket card | `linear-gradient(104.43deg, rgba(199,251,148,.5) 14%, rgba(163,243,150,.5) 98%)` i.e. lime `#C7FB94` → `#A3F396` at 50% |
| Guru points | pink `#FB3E7F`, orange `#FF872C`, bg `#FFF5F9` |
| Segment colours | black `rgb(70,74,80)`, gold `rgb(255,201,55)`, platinum `rgb(214,205,192)`, silver `rgb(179,198,216)` |

### 1.3 Status, rating, price

| Role | Value | Where |
|---|---|---|
| Success | `#53AF24`, bg `#DDEFD3`, alt `#BADFA8` | "Что было хорошо:", "Все налоги включены" |
| Success strong text | `#008900` | "Беспл. отмена", "Завтрак включён", "Бесплатная отмена до 22 ноября*" |
| Deal chip | text `#3F9E10` on `rgba(83,175,36,.2)`, 13/16 500, radius 4, pad 2px 8px | "Лучшая цена" |
| Rating badge 8.0+ | `#25AC03` | SVG bookmark flag, white bold number |
| Rating badge 7.x | `#91D30A` | observed for 7,4 |
| Alert / error / scarcity | `#CE2121`, hover `#BA0505`, bg `#FCEAEA`/`#FAE9E9`, outline `rgba(206,33,33,.4)` | "На нашем сайте осталось 5 номеров", "Что было плохо:", danger button |
| Warning | `#E77C00`, bg `#F6E4CE`, alt `#FFAD4E` | |
| Highlight bg | `#FFF8E6` | |
| Calendar holiday | `#BE0000`, edge `#FFDDBB` | |
| Hotel stars | gradient `#FFAF00` → `#F29006`, 7px star SVG | |
| Beach promo card frame | `linear-gradient(90deg, #FFECBF, #FFB9B7)`, radius 18, pad 2 | "Пляж рядом" card variant |
| Dark tag | `#2D3137` bg, white 12/16 480, radius 6, pad 2px 6px | "Бесплатная отмена" over photo |
| Photo count badge | `#464A4F` bg, white 14/16, radius 8, pad 7px 12px | "11 фото" |

### 1.4 Neutrals and surfaces

| Role | Value | Token |
|---|---|---|
| Text primary | `#2D3137` | `--palette-black`, `--text`, `--p-neutral-80` |
| Display headings | `#000000` | `--mpf-color-text-primary` |
| Text grey (marketing) | `#464A4F` | `--mpf-color-text-grey` |
| Text secondary / labels | `#868686` | `--palette-dark`, `--p-neutral-50` |
| Disabled | `#AFAFAF` | `--palette-disabled` |
| Border strong / input outline | `#C8C8C8` | `--palette-gray`, `--p-neutral-20` |
| Border default | `#E5E5E5` | `--palette-light`, `--border`, `--field-border` |
| Surface secondary / page canvas (SERP, hotel) / filled input | `#F4F4F4` | `--palette-ulight`, `--block-bg-secondary` |
| Surface tertiary | `#F8F8F8` | `--p-neutral-03` |
| Surface | `#FFFFFF` | `--block-bg` |
| Dark block | `#2D3137` | `--block-bg-alt` |
| Shadow colour | `rgba(45,49,55,0.3)` | `--shadow` |
| Subtle borders (marketing) | `#0000001F`, `#00000014` | `--mpf-color-border-*` |
| Overlay (promo modal) | `rgba(0,0,0,0.8)` | Flocktory |
| Disabled cover | `rgba(246,246,246,0.8)` | |

### 1.5 Map tile palette (sampled)

Sea `#AADAFF`, parks/forest `#BFECAC`–`#C2EAB1`, built-up greys `#E1E1E1`–`#F3F3F3`, Leaflet
container fallback `#DDDDDD`. Bright, saturated light scheme; roads pale yellow, transit icons blue.

## 2. Typography

Font files (self-hosted woff2/woff from `mpf.fastrovok.net/.../_next/static/assets/`):
- **PT Root UI Web** 300 / 400 / 500 / 700. Stack: `"PT Root UI Web", Helvetica, Arial, sans-serif`.
  Base `html { font-size: 16px; line-height: 1.375 }`. Many UI labels use `font-weight: 480`, which
  resolves to the 500 file.
- **Spoof** Medium 500 only, `font-feature-settings: "ss06"`. Stack `Spoof, sans-serif`. A geometric
  display grotesk with quirky round letterforms. Used only for marketing headings.

| Use | Family | Size / line-height | Weight | Colour |
|---|---|---|---|---|
| Home hero title "Ооооочень много отелей и квартир!" | Spoof | 48 / 52 | 500 | `#000` |
| Home section h2 desktop | Spoof | 36 / 40 | 400→500 file | `#000` |
| Home section h2 mobile | Spoof | 24 / 24 | 500 | `#000` |
| Section subtitle | PT Root | 24 / 24 desktop, 16 / 22 mobile | 480 | `#2D3137` |
| Blog card large | Spoof | 32 / 32, letter-spacing -0.32px | 500 | white |
| Destination card name | Spoof | 24 / 28 | 500 | white |
| App sheet title | Spoof | 20 / 24 | 700 | `#2D3137` |
| Hotel page h1 | PT Root | 20 / 24 | 700 | `#2D3137` |
| Hotel section title ("Доступные варианты") | PT Root | 24 / 30 | 700 | |
| Room name | PT Root | 20 / 24 | 700 | |
| Home gallery card hotel name | PT Root | 18 / 22 | 700 | |
| SERP hotel name | PT Root | ~18 / 22 | 700 | |
| Filter group title | PT Root | 16 / 22 (L) and 14 / 20 (S) | 700 | |
| Body | PT Root | 16 / 22 | 400 | `#2D3137` |
| Small | PT Root | 14 / 20 | 480 | |
| Caption / meta | PT Root | 12 / 16 | 480 | `#868686` |
| Input floating label | PT Root | 12 / 16 | 480 | `#868686` |
| Input value | PT Root | 16 / 20 | 480 | `#2D3137` |
| Button | PT Root | 16 / 20 (24 on L) | 500 | |
| Price, home gallery card | PT Root | 24 / 30 | 700 | `#2D3137` |
| Price, SERP rate | PT Root | 20 / 24 | 700 | |
| Price, hotel header "от 13 054 ₽" | PT Root | 20 / 25 | 600 | |
| Price subtext "за 3 ночи для 2 гостей" | PT Root | 12 / 16 | 480 | `#868686` |
| Map pin | PT Root | 14 / 20 | 700 | |
| Rating number | PT Root | 16 / 16 | 700 | white |
| Rating word "Превосходно" | PT Root | 16 / 22 | 700 | |
| Reviews count | PT Root | 12 / 16 | 480 | `#868686` |
| Calendar day | PT Root | 16 / 22 | 400 (selected 700) | |
| Calendar month heading | PT Root | 20 bold (right pane), 16 / 22 500 (left list) | | |
| Weekday header | PT Root | 14, uppercase "ПН ВТ…" | 400 | |

Currency is written `14 505 ₽` with a non-breaking space; ruble sign after the number.

## 3. Shape: radii

Token scales present in CSS:
- `--t-radius-2xs/xs/sm/md/lg`: 4 / 6 / 8 / 12 / 20
- `--mpf-border-radius-small/medium/large/xlarge`: 12 / 16 / 24 / 40
- Frequency in CSS: 12px (32 rules) > 16px (18) > 8px (13) > 4px (11) > 50% (10).

| Element | Radius |
|---|---|
| Buttons S/M ("Хорошо", "Готово", "Посмотреть цены", "Показать все номера") | 12 |
| Search button L (56 tall) | 16 |
| Home search inputs (56 tall) | 16; joined date pair 16 0 0 16 / 0 16 16 0 |
| Generic text inputs (`--t-textinput-radius`) | 12; toggle 8; thumb 6 |
| Price range inputs (paired) | 12 0 0 12 / 0 12 12 0 |
| Home tabs: container / tab | 16 / 14 (2px inset) |
| SERP segmented tabs | 16 |
| Mini segmented control ("за ночь / за все время") | 8 outer, 7 inner |
| Dropdowns / popups (suggest, datepicker, guests) | 12 |
| SERP hotel card | 16 (white, padding 4) ; rate panel inside 12 |
| Filter sidebar card, search summary card | 16 |
| Home hotel gallery card, destination card, promo/email blocks | 24 |
| White sheet overlapping lime hero | 40 40 0 0 desktop, 24 24 0 0 mobile |
| Mobile bottom sheet | 20 20 0 0 |
| Breadcrumb pills on hotel page | 12 |
| Map pins | 8 |
| Map hover card | 12, image 8 |
| Map controls (zoom stack, Развернуть) | 12 |
| Tooltip bubble | 12 |
| Amenity chip | 8 |
| Deal chip | 4 |
| Calendar day selection | 3 (range ends 3 0 0 3 / 0 3 3 0) |
| Switch track | 10 |
| Checkbox/radio in filters | 50% (radio-like circles even for multi-select) |
| Avatar, favourite, carousel arrows, slider thumbs, pin dots | 50% |
| Hotel page gallery tiles | 6 |
| Rating flag | 6 top corners in SVG path, notched bottom |

## 4. Elevation: shadows

The UI is mostly flat: cards sit white on a `#F4F4F4` canvas with no shadow. Shadows appear only on
floating layers.

| Layer | box-shadow |
|---|---|
| Dropdown / popover (suggest, datepicker, guests) | `0 2px 12px 0 rgba(45,49,55,0.3)` |
| Modal / large overlay | `0 8px 40px 0 rgba(45,49,55,0.3)` |
| Map controls and map buttons | `0 4px 12px 0 rgba(0,0,0,0.1)` (`--map-control-shadow`) |
| Map price pin | `::after { box-shadow: inset 0 0 0 1px #E5E5E5, 0 4px 12px 0 rgba(0,0,0,0.1) }` |
| Gallery arrow buttons | `0 2px 8px 0 rgba(0,0,0,0.15)` |
| Map popup close button | `0 2px 10px 0 rgba(0,0,0,0.1)` |
| Home gallery card hover | `inset 0 0 0 1px #C8C8C8` plus bg `#F4F4F4` → `#FFFFFF`, 0.32s |
| Focus | `0 0 0 2px rgba(14,65,210,0.4)` (error: `0 0 0 2px rgba(206,33,33,0.4)`) |
| Mobile sticky price bar | `0 -4px 5px 0 rgba(153,146,139,0.2)` on `rgba(255,255,255,0.9)` |
| Header | none, flat; 48px tall, white (lime on home) |

## 5. Spacing and layout

- Spacing tokens `--t-spacing-*`: 2 / 4 / 8 / 12 / 16 / 20 / 24. Component heights
  `--t-compsize-*`: 32 / 36 / 40 / 48 / 56 / 60. Icon sizes 14 / 14 / 16 / 20.
- Container: `max-width: 1380px`, page padding 30 desktop, 32 tablet (681–1074px), 16 mobile.
  Breakpoint for mobile layout: 680px (`data-is-mobile-size`).
- Header 48px. Home hero section padding `48px 0 92px`; featured section `60px 60px 80px`.
- Home search row: destination 603 wide, dates 2×173, guests 161, button 187; all 56 tall; gaps 8.
  Input padding `0 12px 0 16px`, label stacked above value (label 12px at top, value 16px).
- Home tabs: tab padding `11px 18px`, gap 8, icon+label gap 8; container padding 2, `rgba(255,255,255,.5)`.
- Buttons: XS 36 (pad 0 8), S 40 (pad 0 12), M 48 (pad 0 12), L 56 (pad 0 16). Inner label adds `0 4px`.
- Home gallery card: image 176 tall, details padding `16px 16px 12px`; gallery gap 12.
- Destination card: 254×420, padding 24, text at bottom over gradient backdrop.
- SERP: left filter column 250 wide (card padding 16), results 800 wide, map column rest.
  Hotel card padding 4, gap 4; image ~289 wide; right column padding 8; rate panel padding 12,
  inner gap 16. Cards stacked with ~12px gap.
- Hotel page: header card padding `12px 20px 12px 16px`; info cards padding 16; gallery gap 4;
  rooms section padding 24.
- Dropdown suggest: padding `8px 16px`; region rows 32 tall, hotel rows 48 tall (two-line).
- Tooltip: padding `16px 12px 12px`.

## 6. Logo, favicon, meta

Logo: `https://ost.fastrovok.net/ostrota/theme/ostrovok_v2/logo-20240322100815.svg`
(also exposed as `--brand-logo`). Rendered as `<img>` in `a.Logo_logo` at 130×40, max-height 40.
Shape: lowercase-style geometric wordmark "Островок!" in a single flat colour `#0E41D2`. Capital
"О" is a large near-perfect ring taller than the x-height; rounded terminals; letters drawn with
uniform stroke; an exclamation mark closes the word as a brand device (also seen as "О!Блог").
No symbol, no gradient. The favicon reuses the "О!" pair.

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="130px" height="40px" viewBox="0 0 130 40" style="fill-rule:evenodd;clip-rule:evenodd">
 <defs><style type="text/css"><![CDATA[ .fil0 {fill:#0E41D2;fill-rule:nonzero} ]]></style></defs>
 <g>
   <path class="fil0" d="M71.84 24.51c-2.16,0 -3.79,-1.8 -3.79,-3.97 0,-2.16 1.63,-3.96 3.79,-3.96 2.17,0 3.98,1.8 3.98,3.96 0,2.17 -1.81,3.97 -3.98,3.97zm0.1 -11c-3.8,0 -6.87,3.07 -6.87,7.03 0,3.97 3.07,6.85 6.87,6.85 3.79,0 6.86,-3.06 6.86,-6.85 0,-3.78 -3.07,-7.03 -6.86,-7.03z"/>
   <path class="fil0" d="M56.9 24.67c-2.25,0 -3.94,-1.88 -3.94,-4.13 0,-2.25 1.69,-4.13 3.94,-4.13 2.06,0 3.74,1.88 3.74,4.13 0,2.25 -1.68,4.13 -3.74,4.13zm0.4 -11.16c-1.71,0 -3.27,0.8 -4.36,2.15l-0.13 -1.79 -2.92 0 0 17.85 3.25 0 0 -5.05 -0.15 -1.34c1.09,1.29 2.63,2.06 4.31,2.06 3.43,0 6.32,-3.06 6.32,-6.85 0,-3.78 -2.89,-7.03 -6.32,-7.03l0 0z"/>
   <path class="fil0" d="M29.3 16.58c1.44,0 2.7,0.9 3.43,2.16l2.71 -1.44c-1.09,-2.35 -3.44,-3.79 -6.15,-3.79 -3.79,0 -6.86,3.07 -6.86,7.03 0,3.97 3.07,6.85 6.86,6.85 2.71,0 5.06,-1.44 6.15,-3.78l-2.71 -1.45c-0.73,1.27 -1.99,2.17 -3.43,2.17 -1.99,0 -3.8,-1.8 -3.8,-3.79 0,-2.16 1.81,-3.96 3.8,-3.96z"/>
   <polygon class="fil0" points="36.34,16.76 40.68,16.76 40.68,27.03 43.75,27.03 43.75,16.76 48.09,16.76 48.09,13.87 36.34,13.87 "/>
   <path class="fil0" d="M11.41 24.15c-3.25,0 -6.15,-2.89 -6.15,-6.31 0,-3.25 2.9,-6.13 6.15,-6.13 3.43,0 6.14,2.88 6.14,6.13 0,3.42 -2.71,6.31 -6.14,6.31zm0 -15.87c-5.24,0 -9.4,4.33 -9.4,9.56 0,5.22 4.16,9.55 9.4,9.55 5.24,0 9.57,-4.15 9.57,-9.55 0,-5.41 -4.15,-9.56 -9.57,-9.56z"/>
   <path class="fil0" d="M125.73 27.39c1.2,0 2.17,-0.97 2.17,-2.16 0,-1.2 -0.97,-2.17 -2.17,-2.17 -1.2,0 -2.17,0.97 -2.17,2.17 0,1.19 0.97,2.16 2.17,2.16z"/>
   <polygon class="fil0" points="127.09,21.08 127.99,8.28 123.47,8.28 124.38,21.08 "/>
   <path class="fil0" d="M116.57 20.36c1.08,-0.18 1.8,-0.72 2.53,-2.52l1.44 -3.97 -3.16 0 -1.27 3.79c-0.36,1.08 -0.99,1.44 -1.89,1.44l-1.54 0 0 -5.23 -3.16 0 0 13.16 3.16 0 0 -5.23 1.36 0c1.08,0 1.53,0.36 2.07,1.44l1.63 3.79 3.52 0 -1.99 -4.33c-0.72,-1.44 -1.62,-2.16 -2.71,-2.34l0.01 0z"/>
   <path class="fil0" d="M87.3 24.51l-3.44 0 0 -3.07 3.62 0c0.9,0 1.63,0.54 1.63,1.45 0,1.08 -0.73,1.62 -1.81,1.62l0 0zm-3.44 -8.1l3.26 0c1.08,0 1.62,0.38 1.62,1.34 0,0.58 -0.18,1.53 -1.44,1.53l-3.44 0 0 -2.87zm6.17 3.98l0 -0.06c0,0 1.78,-0.74 1.78,-3.03 0,-2.06 -1.62,-3.43 -4.51,-3.43l-6.51 0 0 13.16 6.82 0c2.89,0 4.74,-1.27 4.74,-3.72 0,-2.46 -2.32,-2.92 -2.32,-2.92l0 0z"/>
   <path class="fil0" d="M100.57 24.51c-2.16,0 -3.79,-1.8 -3.79,-3.97 0,-2.16 1.63,-3.96 3.79,-3.96 2.17,0 3.98,1.8 3.98,3.96 0,2.17 -1.81,3.97 -3.98,3.97zm0.1 -11c-3.8,0 -6.87,3.07 -6.87,7.03 0,3.97 3.07,6.85 6.87,6.85 3.79,0 6.86,-3.06 6.86,-6.85 0,-3.78 -3.07,-7.03 -6.86,-7.03z"/>
 </g>
</svg>
```

(Markup copied from the served file; CorelDRAW metadata/doctype trimmed. Reference only: the logo
is Ostrovok's trademark and must not be reused for the sibling brand.)

Favicon: `https://ost.fastrovok.net/ostrota/theme/ostrovok_v2/favicon-20240322165030.png`
(32×32 and 192×192 declared; file is 128×128). A lime `#ACEF81` rounded square (squircle, ~22%
corner) with a heavy cobalt "О!" centred. The same tile is the app icon in the smart banner and
the app-install sheet.

Titles:
- Home: `Ostrovok.ru – бронирование отелей и гостиниц, забронировать отель или гостиницу самостоятельно онлайн`
- SERP: `Отели в Сочи — забронировать гостиницу в Сочи, цены 2026 на бронирование отелей в Сочи`
- Hotel: `AZIMUT Парк Отель Виноградная Сочи 4* 4* в Сочи 47 отзывов об отеле, цены и фото номеров - забронировать гостиницу AZIMUT Парк Отель Виноградная Сочи 4* онлайн`
  Pattern: SEO keyword strings, `Brand.ru – …` on home, city/hotel first elsewhere.

Open Graph (home): `og:site_name` Ostrovok.ru, `og:type` website, `og:locale` ru_RU,
`og:title` "Ostrovok.ru - удобный сервис поиска и бронирования отелей по всему миру",
`og:description` "Низкие цены, более 1 700 000 вариантов отелей и апартаментов по всему миру,
круглосуточная поддержка", `og:email` hi@ostrovok.ru, `og:phone_number` +7 499 215-65-25.
No `og:image` meta was present on the home page.

## 7. Components

### Header
48px, full width, logo left at 16px inset. Right cluster: "Зарегистрировать объект" pill
(secondary blue bg `#E3EBFD`, text `#0E41D2`, radius 12, pad 0 8, 34 tall; on the lime home header
it is a translucent lime-white pill), filled cobalt icons 20px (heart/favourites, bell, flag
language, apps grid, help bubble), avatar circle + "Войти", hamburger. Background lime `#ADEF81` on
home, white elsewhere. No shadow or border. Mobile adds a smart app banner above
(app tile, "Островок! В приложении цены ниже!", star rating, "Смотреть").

### Search form (home)
- Product tabs: "Жильё" (active: white chip, cobalt text+icon) / "Трансферы" inside a
  translucent white container; separate "Для командировок ↗" link pill.
- Fields: white, 1px `#E5E5E5`, radius 16, 56 tall, floating label (12px grey) above value.
  Hover border `#C8C8C8`; focus adds 2px cobalt 40% ring. Dates are a joined pair with a hairline
  divider. Guests field shows "1 номер для / 2 гостей" with a chevron that flips when open.
- CTA "Найти": cobalt, 56 tall, radius 16, 16/24 500 white; hover `#0636C8`.
- Switch "Только квартиры": 36×20 track, radius 10, grey track `#E5E5E5`, white thumb, loading
  state animates a stripe (`Switch_loading`).
- Onboarding tooltip: cobalt bubble with 1px white border, radius 12, 3D key illustration, close ×,
  arrow pointing to the switch; fades/slides in over 0.8s.
- Mobile: fields stack full width, button full width 56, tabs centred.

### Destination suggest (custom dropdown)
White popover flush under the field (1px gap), width of the field, radius 12, shadow
`0 2px 12px rgba(45,49,55,.3)`, padding 8px 16px. Group headers "Регионы", "Отели" in 12px.
Rows: 20px dark glyph icon (city skyline, pin, hotel), 16px text; hotel rows add a flag and
address in 12px grey. Active row: full-bleed `rgba(14,65,210,.1)`. While loading, a three-dot
cobalt `DotsLoader` (scale pulse 1.6s) sits in the empty popover.

### Date picker
Popover 459×500 under the dates, radius 12, same shadow. Left rail: scrollable month list with
year labels (current month bold). Right: continuous vertical scroll of months, weekday header
"ПН ВТ СР ЧТ ПТ СБ ВС", month name 20px bold, day cells 32×36. Past days light grey; selected
ends: cobalt fill, white bold, radius 3; in-range days `rgba(0,0,0,.05)` band with no radius.
Uses native OS scrollbars (visible grey bars) in both panes. Pick check-in then check-out; popover
closes and fills both fields ("25 нояб. 2026 г.").

### Guests dropdown
370px popover, radius 12, same shadow, padding ~20. Title "1 номер" 20/24 bold, labels
"Взрослые" / "Дети" 12px 500. Counter: "− 2 +" inside a 1px `#E5E5E5`, radius 12, 36-tall box,
glyph buttons 36×36 transparent. Children: native `<select>` styled as a bordered box
"Добавить ребёнка" (radius 12). Footer: "+ Добавить номер" cobalt text link (16 500) and primary
"Готово" button 48 tall, radius 12.

### SERP layout
Page canvas `#F4F4F4`. Three columns on desktop: filters (250), results (800), map (collapsed
~327px column with "Развернуть" button; expanding swaps the layout to a 320px list and a wide map).
- Search summary card (white, radius 16): city in cobalt 16/22 500, dates and guests below,
  search icon at right.
- Type tabs "Все / Отели / Апартаменты и квартиры": white container radius 16, active tab
  `#E3EBFD` fill with 2px cobalt outline, 48 tall.
- Result count "4957 доступных вариантов в Сочи" 16/22 bold (an h1). While loading:
  "Ищем варианты в Сочи" with skeleton cards.
- Hotel card (horizontal): white, radius 16, padding 4; photo carousel on the left (inner radius
  ~12, dark circular arrows on hover, favourite heart-plus button in a white rounded square at
  top-right of photo). Right column: stars, name 18 bold with "TOP↗" gradient badge (purple-blue),
  address and distances in 12px; rating block at top-right: word ("Превосходно", "Отлично") 16 bold,
  reviews count 12 grey, green bookmark flag with the score. Amenity glyph row. GURU strip
  (lime gradient, radius 12): "Войдите и забронируйте за 13 054 ₽" + "✦ GURU". Rate panel
  (`#F4F4F4`, radius 12, padding 12): room name, value-add list with icons (meal, cancellation
  green or neutral, payment), price 20/24 bold with "за 3 ночи для 2 гостей", red scarcity line.
  CTA "Показать все номера" primary S, right-aligned.
- "Пляж рядом" promoted card: 2px peach→pink gradient frame (radius 18) with a header strip and
  emoji umbrella.
- Mobile card: vertical, photo with pagination dots, name 1 line ellipsis, price block, red
  scarcity, GURU strip; filter and map buttons as 54px white squares (radius 12) next to the
  summary card.

### Filters
White card, groups separated by bold titles: "Избранное" switch row (red heart icon),
"Сортировка" react-select (1px border, radius 12, chevron), "Цена" with mini segmented control
("за ночь" / "за все время" on `#E5E5E5`, active white, 12px text) + paired min/max inputs (36 tall,
1px `#C8C8C8`, radius 12 joined) + dual-handle slider (4px track `#E5E5E5`, active `#0E41D2`, 22px
cobalt round thumbs, white centre ring visible in screenshots), then themed groups with emoji
("⛱ Летний отдых"), sub-titles 14 bold ("В отеле", "В номере", "Расстояние до пляжа"), option rows
14/20 with a 16px round control (1px `#E5E5E5`, radius 50%) and counts right-aligned 12px grey.
Radio groups show a thick cobalt ring when selected.

### Rating badges
Card/list: 35×48 SVG bookmark (`viewBox 0 0 43 60`, 6px top radii, V-notched bottom), fill
`#25AC03` for ≥8, `#91D30A` for 7.x; white 16px bold score "9,1" (comma decimal).
Hotel page desktop: same flag 36×42 next to "Превосходно / 47 отзывов". Hotel page mobile:
rounded-square green tile inside a `#F4F4F4` pill row "9,1 Превосходно … 47 отзывов >".

### Price display
Bold, dark, never cobalt. Ruble sign after number. Always paired with a 12px grey qualifier
("за 3 ночи для 2 гостей", "от" prefix on landing/hotel header). Strikethrough old price 12px grey
on GURU banners ("от 14 505 ₽"). "Все налоги включены" in green 12px. Mobile hotel page has a
sticky bottom bar: frosted white, centred pill CTA "Цены от 13 054 ₽".

### Buttons hierarchy
1. Primary: `#0E41D2` bg, white 16/500, radius 12 (16 for L), transitions 0.16s on bg/color/shadow.
   Hover `#0636C8`, active `#0017B0`, focus ring 2px 40% cobalt, disabled grey cover.
2. Secondary (tinted): `#EDF2FC` / `#E3EBFD` bg, cobalt label ("Читать все отзывы • 44",
   "Все удобства • 89", "Изменить").
3. Outline: 1px cobalt border, cobalt label (tokens present).
4. Ghost / link: cobalt text, hover `#2A63F5` ("Показать на карте", "+ Добавить номер", "Ещё").
5. Neutral floating: white bg, dark text, radius 12, map-control shadow ("Развернуть", breadcrumbs
   "‹ Все варианты в Сочи", "Новый поиск").
6. Danger: `#CE2121`, hover `#BA0505`.
7. Inverted (on dark/colour): white bg with cobalt label.
Promo CTA in the Flocktory modal is a lime pill ("Войти и обновить цены") on a blue gradient.

### Map
- Provider: **Leaflet** (`window.L`, `.leaflet-container`) with Ostrovok's own raster tile server
  `https://tiles.fastrovok.net/api/v1/t/ostrovok/ru/{z}/{x}/{y}.png`; attribution
  "© Участники OpenStreetMap". Light, saturated OSM-style palette (sea `#AADAFF`, greens
  `#BFECAC`). No dark mode.
- Price pin: white rounded rectangle (radius 8), padding `3px 7px`, 14/20 bold `#2D3137`, centred on
  the coordinate with `translate(-50%,-50%)`, no tail. Edge = inset 1px `#E5E5E5`, drop shadow
  `0 4px 12px rgba(0,0,0,.1)` on `::after`. Hover/active: background `#0E41D2`, white text
  (`transition: background-color, color .16s ease-in`) and a preview card pops above.
- Cluster pin: same pill with count and min price: "3 от 10 389 ₽". No circles or bubbles.
- GURU pin: pill with a 20px gradient four-point sparkle on the left (padding-left 27).
- Favourite pin: heart icon at left (padding-left 25).
- Unpriced hotels: 8px `#2D3137` dots with 1px white ring.
- Search centre: 16px cobalt dot with 2px white border.
- Hover card: white, radius 12, 96 tall, 108px image with 4px gutter and 8px radius, name 14/20
  bold ellipsis, price 16/22 bold, rating flag; enters with 0.2s fade + 10px rise.
- Controls: zoom stack 40×78 white, radius 12, shadow `0 4px 12px rgba(0,0,0,.1)`; "Свернуть"
  white button 40 tall; "Искать при перемещении карты" checkbox chip; location search field
  "Введите местоположение"; scale bar bottom-left in a white pill.
- Mobile map: full screen, summary card + filter + close square buttons on top, same pins, larger.

### Hotel page
Breadcrumb pills (white, radius 12). Header card (white, radius 16): stars, name 20 bold, TOP and
GURU badges, address with "Показать на карте" link 12 bold cobalt, distances 12 grey; right side
"от 13 054 ₽" + heart button (`#F4F4F4` rounded square) + primary "Посмотреть цены". Mosaic
gallery (1 large + 6 tiles, radius 6, gap 4, "+38 фото" overlay). Three info cards (radius 16):
reviews with green/red "Что было хорошо: / Что было плохо:", popular amenities with glyph icons,
nearby places with grey distance chips. Rooms: filter chips (outlined, chevron) "Кровати",
"Питание", "Оплата", "Условия отмены"; room group with photo (count badge), amenity chips
(`#F4F4F4`, radius 8, pad 4 8, 14px), and rate columns on `#F4F4F4` (radius 16): GURU ticket card
(lime gradient, perforation dots across, "Забронируйте со скидкой 10 %") and plain white rate cards
with value-add lists and full-width "Забронировать".

### Toasts, banners, errors
- Cookie banner: dark graphite floating bar at bottom centre, radius ~12, "Мы используем куки для
  аналитики и правильной работы сайта" with underlined "куки" link and a primary S "Хорошо".
- Scarcity alert card on hotel page: `#FCEAEA` bg, red 14 bold text, radius 16, padding 12.
- Promo modal (Flocktory, third-party): blue-to-cyan gradient, 3D glossy chest with hearts,
  Spoof headline "Своим - дешевле!", lime pill CTA, white × close, overlay `rgba(0,0,0,.8)`.
- App-install bottom sheet (mobile): radius 20 top, grabber, app tile, Spoof title
  "В приложении удобнее", full-width primary M "Установить приложение", phone mockup.
- No validation error toast was triggered during the session.

### Scrollbars
Native OS scrollbars everywhere they show (page, datepicker panes, suggest list); no custom
`::-webkit-scrollbar` styling for vertical scroll. Horizontal carousels hide scrollbars
(`scrollbar-width: none`, `::-webkit-scrollbar {display:none}`) with `scroll-snap-type: x mandatory`.
`html { scrollbar-gutter: stable }`.

## 8. Motion

- Base duration **0.16s ease** for colour, background, border-color, box-shadow, fill
  (buttons, inputs, tabs, links, pins). Examples: buttons `background-color .16s, color .16s,
  box-shadow .16s`; inputs `border-color .16s, box-shadow .16s`; tabs `color .16s`.
- **0.32s** for card background/shadow and image `transform` (destination card image zoom),
  `scale .32s ease`.
- Accordions animate `grid-template-rows` .2s–.6s.
- Tooltip `opacity .8s, transform .8s`.
- Bottom sheet: overlay fade, container `translateY(100%) → 0`.
- Map hover card: `opacity 0, translate3d(0,10px,0) → 1, 0` over .2s.
- Skeletons: flat `#E5E5E5` blocks (hotel card skeleton keeps the card shape: white, radius 16,
  image block radius 12) pulsing opacity `1 → .4` in **0.6s ease-in-out infinite alternate**.
- Images fade in `.15s ease-in-out` after load, with a flashing placeholder.
- Dots loader: three dots scaling 0 → 1 → 0, 1.6s infinite.
- Easing: only keyword easings (`ease`, `ease-in`, `ease-out`, `ease-in-out`); no cubic-bezier.
  Overall motion is quick and quiet; no bouncy or spring motion in product UI.

## 9. Icons

- Solid filled glyphs (no outline/stroke icons), soft rounded geometry, single colour.
- Header icons 20–22px filled `#0E41D2` (heart, bell, profile, help bubble, apps grid).
- In-content icons 16px filled `#2D3137` (wifi, car, P-parking, child, pool, 16+ badge, meal,
  cancellation arrow, wallet, bed, beach umbrella). Icon-size tokens 14/16/20.
- Chevrons are filled paths, not strokes. The GURU sparkle is a four-point star with a
  blue-violet gradient. Stars are small gradient yellow-orange.
- Marketing uses 3D glossy illustrations (key, treasure chest, hearts) and emoji in filter and
  promo labels (⛱).

## 10. Copy tone (verbatim)

Playful, warm, short, lots of exclamation marks, colloquial Russian. Product UI copy stays
concise and factual.
- "Ооооочень много отелей и квартир!" (hero, stretched vowel)
- "Лежать и не переживать помог Островок!" + "промокод: ЛЕЖАТЬ / скидка: 3000₽"
- "Своим - дешевле!" / "Доступ к секретным скидкам откроется сразу же после авторизации с программой лояльности ГУРУ" / "Войти и обновить цены"
- "Чувствуйте себя как дома даже в поездке"
- "Время осенних скидок" / "Успейте забронировать до 31 октября со скидкой до 34%"
- "Подпишитесь и превратите ваши «Входящие» в сокровищницу скидок и промокодов"
- "Записки гастрономического туриста", "Маршруты мистических историй", "О!Блог"
- "Забронируйте впечатления", "Оплата рублями — даже если отель не в РФ", "Скидки до 40% по программе лояльности ГУРУ"
- "В приложении цены ниже!", "В приложении удобнее", "Установить приложение"
- "Мы используем куки для аналитики и правильной работы сайта" / "Хорошо"
- UI: "Направление", "Город, отель или аэропорт", "Заезд", "Выезд", "1 номер для", "2 гостей",
  "Найти", "Только квартиры", "Добавить ребёнка", "Добавить номер", "Готово",
  "Ищем варианты в Сочи", "4957 доступных вариантов в Сочи", "Показать все номера",
  "На нашем сайте осталось 5 номеров", "Беспл. отмена", "Без беспл. отмены", "Оплата на сайте",
  "Войдите и забронируйте за 13 054 ₽", "Лучшая цена", "Все налоги включены",
  "Искать при перемещении карты", "Развернуть", "Свернуть", "Введите местоположение",
  "Посмотреть цены", "Цены от 13 054 ₽", "Читать все отзывы • 44", "Превосходно", "Отлично".

## 11. What makes it feel like Ostrovok

1. Cobalt `#0E41D2` plus acid lime `#ACEF81`: a two-colour identity; lime floods the home header
   and favicon, cobalt carries every action.
2. The Spoof display face with the "О!" motif: rounded, slightly odd geometric headlines,
   exclamation marks and stretched words in marketing copy.
3. Soft big radii on a flat canvas: 12/16/24, a 40px white sheet overlapping the lime hero,
   white cards on `#F4F4F4` with no shadows; shadows only for floating layers.
4. Green bookmark-flag rating badge (`#25AC03`) with a comma decimal.
5. Price-first information design: bold dark prices, grey "за N ночи для N гостей" qualifiers,
   red scarcity and green cancellation/benefit lines.
6. Map with white 8px price pills (clusters read "N от X ₽") that turn cobalt on hover, on bright
   OSM-style tiles.
Also: the GURU loyalty layer (blue-violet sparkle, lime-gradient ticket cards) and tinted
light-blue secondary buttons / selected states.

## 12. Screenshots

Saved in `work/design/source/`:
- `ostrovok-home-desktop.png`, `ostrovok-home-desktop-full.png`, `ostrovok-home-promo-modal-desktop.png`
- `ostrovok-home-suggest-desktop.png`, `ostrovok-datepicker-desktop.png`, `ostrovok-guests-dropdown-desktop.png`
- `ostrovok-serp-desktop.png`, `ostrovok-map-desktop.png`, `ostrovok-map-hover-desktop.png`
- `ostrovok-hotel-desktop.png`, `ostrovok-hotel-rooms-desktop.png`
- `ostrovok-home-mobile.png`, `ostrovok-home-app-sheet-mobile.png`, `ostrovok-serp-mobile.png`,
  `ostrovok-map-mobile.png`, `ostrovok-hotel-mobile.png` (mobile shots are 750 px wide, DPR 2)

## 13. Limitations

- Cross-origin stylesheets could not be read through `document.styleSheets`; their rules were read
  from downloaded copies, so the values are static CSS, not per-state computed values.
- Rating colours below 7 were not observed. Lower tiers probably use other colours; not verified.
- The cookie banner background was judged from the screenshot, not measured.
- No form error, empty-results or toast state was triggered.
- The collapsed desktop SERP map column looked dark grey at first render; it was not investigated
  further. The expanded map is the light tile scheme above.
- Third-party overlays (Flocktory modal, Adfox banners, UX feedback widgets) are not Ostrovok's
  design system and are noted only as context.
