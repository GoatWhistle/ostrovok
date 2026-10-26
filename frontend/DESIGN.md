---
name: Factmap
description: Hotel search where every match is a verifiable fact on the map
colors:
  night-950: '#0a1223'
  night-900: '#101e32'
  night-50: '#e8f5ff'
  night-300: '#abc2d2'
  frost-50: '#f0f4f8'
  cyan-300: '#5ce5ff'
  cyan-700: '#066a81'
  pink-300: '#f6a2d4'
  pink-700: '#ac287e'
  cobalt-600: '#1546db'
  cobalt-500: '#3763ee'
  cobalt-300: '#8eabff'
  cobalt-50: '#eef3ff'
  lime-400: '#b0ea55'
  lime-700: '#57871c'
  lime-100: '#ebfbcf'
  neutral-0: '#ffffff'
  neutral-25: '#fbfbf8'
  neutral-50: '#f4f5f1'
  neutral-100: '#eaece5'
  neutral-600: '#61665a'
  neutral-900: '#1d201a'
  neutral-950: '#12140f'
  green-600: '#1b8445'
  red-600: '#be2d1f'
  map-light-land: '#eef0e8'
  map-light-water: '#bcd8f0'
  map-dark-land: '#161913'
  map-dark-water: '#0d1c29'
typography:
  display:
    fontFamily: '"Manrope Variable", "Manrope", ui-sans-serif, system-ui, sans-serif'
    fontSize: clamp(2.5rem, 1.4rem + 4vw, 5.5rem)
    fontWeight: 800
  heading-lg:
    fontFamily: '"Manrope Variable", "Manrope", ui-sans-serif, system-ui, sans-serif'
    fontSize: clamp(1.75rem, 1.3rem + 1.4vw, 2.5rem)
    fontWeight: 800
  heading:
    fontFamily: '"Manrope Variable", "Manrope", ui-sans-serif, system-ui, sans-serif'
    fontSize: 1.5rem
    fontWeight: 750
  subheading:
    fontFamily: '"Manrope Variable", "Manrope", ui-sans-serif, system-ui, sans-serif'
    fontSize: 1.125rem
    fontWeight: 750
  body:
    fontFamily: '"Manrope Variable", "Manrope", ui-sans-serif, system-ui, sans-serif'
    fontSize: 1rem
    fontWeight: 450
    lineHeight: 1.55
  body-sm:
    fontFamily: '"Manrope Variable", "Manrope", ui-sans-serif, system-ui, sans-serif'
    fontSize: 0.875rem
    fontWeight: 450
    lineHeight: 1.45
  label:
    fontFamily: '"Manrope Variable", "Manrope", ui-sans-serif, system-ui, sans-serif'
    fontSize: 0.8125rem
    fontWeight: 650
  caption:
    fontFamily: '"Manrope Variable", "Manrope", ui-sans-serif, system-ui, sans-serif'
    fontSize: 0.75rem
    fontWeight: 450
  mono:
    fontFamily: '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace'
    fontSize: 0.75rem
rounded:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  pill: 999px
spacing:
  '2': 2px
  '4': 4px
  '8': 8px
  '12': 12px
  '16': 16px
  '24': 24px
  '32': 32px
  '48': 48px
  '64': 64px
components:
  button-primary:
    backgroundColor: '{colors.cyan-300}'
    textColor: '{colors.night-950}'
    rounded: '{rounded.md}'
    height: 44px
  button-fact:
    backgroundColor: '{colors.lime-400}'
    textColor: '{colors.neutral-950}'
    rounded: '{rounded.md}'
  chip:
    rounded: '{rounded.md}'
    height: 36px
  hotel-card:
    rounded: '{rounded.md}'
    padding: 12px
  chat-bubble:
    rounded: '{rounded.lg}'
    padding: 12px 16px
  composer:
    rounded: '{rounded.lg}'
    height: 56px
---

# Design System: Factmap

The approved source is the HTML design system in `work/design/system/` (built into
`work/design/factmap-design-system.html`). Runtime values live only in `src/shared/styles/tokens/`.
This file explains what the tokens mean; when they disagree, the tokens win.

## Overview

**North star: the city after sunset.** The interface follows map style No. 5, "Night neon",
chosen by the user on 2026-10-26: deep navy surfaces, one cyan action colour and pink walking
routes. The mark keeps its folded map of two cobalt sides and a lime middle; lime still means a
confirmed fact or a complete match. Everything else stays quiet so that facts and their sources
read first. The reference is `work/map-styles/05-neon.html`.

- Navy grounds in dark, cool frost grounds in light; one cyan action colour, one lime fact colour.
- Manrope for every role, with heavy weights for headings; JetBrains Mono only for values and codes.
- Flat surfaces separated by tone; hairline rings only on fields, shadows only for floating layers.
- Honest states: unknown, computing, conflict and missing are visibly different from "no".

## Colors

- **Cyan** (`--action-primary`, `--focus-ring`, `--text-accent`, `--status-info`): primary buttons
  with dark text in dark theme and white text in light theme, the user's chat bubble, focus, links
  and the selected object. Light theme uses the deeper `cyan-700` with the same meaning.
- **Pink** (`--map-route`): the walking route and its direction. It never means an error and never
  replaces a fact or conflict status.
- **Lime** (`--action-fact`, `--surface-highlight`, `--map-fact`): the fact. Used for complete match
  badges, "Показать на карте", text selection and fact geometry. Never for decoration.
- **Cobalt**: only the brand mark.
- **Night and frost neutrals**: `--surface-base` page, `--surface-raised` cards and bubbles,
  `--surface-sunken` tracks and tiles, `--surface-overlay` floating layers. Dark theme is the main
  reference; light theme keeps the same roles on cool surfaces with dark text.
- **Status**: success green, danger red, warning amber, conflict violet, info cyan, neutral grey;
  each has a surface and a text pair and always comes with an icon.
- **Characteristic hues** (`--hue-*`): sea, sunset, quiet, nightlife, dark, pets, height, walk. They
  colour the icon of a wish in chips, match rows and fact tiles. They carry meaning, so they colour
  the icon only and never sit behind it as a pastel disc.
- **Map** (`--map-*`): land, water, parks, sand, buildings, roads, labels, sky and terrain shading for
  both themes, plus hotel pins, fact and route colours.

## Typography

Manrope Variable (450, 560, 650, 750, 800) carries display, headings, controls and data; tracking is
tightened on headings. JetBrains Mono is reserved for numbers with units, identifiers and source
codes. Numbers use tabular figures.

## Layout

The search workspace fills the screen under the 64px header: hotels panel (400px), map (`1fr`),
chat (400px); 360px panels below 90rem; one column with Chat / Hotels / Map tabs below 64rem.
Selecting a hotel replaces the list with its card in the same panel, with a "Все отели" back bar.
Other pages use the page shell with 24px gutters (32px from 75rem) and full width.

## Elevation & Depth

Resting surfaces are flat: `--surface-raised` panels and cards sit on `--surface-base` without a
ring or shadow, and hover moves to `--surface-raised-hover`. The header and panel edges use a single
hairline divider. Hairline rings (`--shadow-ring`) stay only on fields (inputs, select, composer),
where they mark the editable area; the selected hotel keeps one cyan ring. The Segmented track is a
sunken tone with a raised, unringed indicator. Shadows and glass are reserved for layers that float
over the map or the page: map controls and overlays use `--shadow-float`, menus and popovers
`--shadow-float` or `--shadow-overlay`, map pins `--shadow-pin`.

## Shapes

Radius scale 4 / 8 / 12 / 16 / 24 / pill. Controls, chips, cards and panels use 12px (8px compact
controls and thumbnails), bubbles and the composer 16px. Fully round shapes are kept for map pins,
the scale and attribution pills over the map and the scrollbar thumb. Bubbles cut one corner to 4px
towards their author.

## Components

- **Button**: primary, secondary, outline, ghost, fact (lime), confirm, reject; regular 44px,
  compact 36px with a 44px hit area, hero 56px; icon-only variant with a tooltip.
- **Chip**: wish chip on a neutral translucent fill with the wish icon in its hue; the pressed and
  static variants take a light tint of the hue. A static variant shows how a request was understood.
- **Hotel card**: flat raised surface, bold name, match score badge (lime when all wishes match),
  address with a pin, rows of wishes with hue icon and status glyph. A 56px thumb appears only when
  the hotel has a photo; there is no placeholder tile in the list.
- **EmptyState / ErrorState**: a 48px icon in the tone colour without a tile, title, text and an
  action; the panel fades in as one piece.
- **Chat**: agent bubbles with the mark as avatar, user bubbles in cyan, result replies with
  understood wishes, corrections, unknown terms, pending work and the lime "show on map" action;
  composer with an auto-growing field and a cyan send button.
- **Banner**, **StatusBadge**, **Confidence**, **Select** (custom listbox), **Segmented**,
  **Disclosure**, **EmptyState**, **ErrorState**, **Skeleton**: see the design system sections.

## Motion

Short and purposeful: enter from `scale(0.95)` plus a 4px shift from the anchor, exits faster than
entrances, durations under 300ms. Rare events get expressive motion: the mark unfolds once per
session, the theme switch reveals as a circle from the click, the language switch as a wave, routes
draw along their path. Reduced motion compresses everything to fades.

## Do's and Don'ts

- Do use lime only for facts and proof; cyan only for actions and selection; pink only for routes.
- Do keep glow on roads, routes and the active object; text, photos, tables and forms stay sharp.
- Do show unknown and computing explicitly; never present missing data as "no".
- Do keep every string in the dictionaries, RU and EN.
- Don't use gradients, glass, emoji, em dashes, arrow glyphs or middle-dot separators.
- Don't draw a status with colour alone; always add an icon and text.
- Don't invent hotels, facts or geometry to fill an empty state.
