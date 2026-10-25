# Refero Styles — extracted design references

Extracted on 2026-10-25 from Refero Styles with Playwright (page innerText and each export tab in Compact and Extended modes). Verbatim blocks are copied as rendered; structured sections quote the page and DESIGN.md. Source-site screenshots live in `work/design/source/`.

Contents: [Style 1 — San Rita](#style-1--san-rita) · [Style 2 — INVERSA](#style-2--inversa)

## Style 1 — San Rita

### Identity

| Field | Value |
|---|---|
| Style name | San Rita |
| Tagline | alpine field guide on sage paper |
| Theme | mixed (from DESIGN.md `**Theme:**`) |
| Refero page URL | https://styles.refero.design/style/f6b396e6-0ad6-402e-9ab9-0034df0d204d |
| Source site (as listed on Refero) | https://sanrita.ca/about |

Description paragraph (verbatim):

> San Rita reads like a field journal for an outdoor boot brand: expansive landscape photography, a single pale mint accent that pops like highlighter on topo paper, and a custom condensed display face that turns section openers into landscape-blocking statements. The visual rhythm alternates between bright, full-bleed imagery and near-black (#161b13) dark bands where tilted Polaroid-style photos scatter across the canvas like a fly-fishing logbook. Typography is utilitarian and small for everything except the display moments — mono caps handle UI chrome while a single massive 300px+ display line carries each section's identity. Components stay flat and unembellished: thin outlined buttons, no shadows, no rounded corners to soften the edges. The whole system feels like topographic map meets adventure zine — confident, outdoorsy, and deliberately raw rather than polished SaaS.

### Source site

Refero lists `https://sanrita.ca/about` as the extraction URL (also in Design Tokens `$extensions.com.refero.extraction.url`, extractedAt `2026-06-03T17:19:53.815Z`). The home page `https://sanrita.ca/` redirects to `https://sanrita.ca/en` (title: 'San Rita | Designing Stories, Brands & Digital Worlds - Atelier San Rita - Creative Studio'). The live site is a creative studio with an outdoor/trail-map concept; the Refero description's 'outdoor boot brand' framing is Refero's interpretation.

### Colors

Color Palette section as rendered on the page (verbatim innerText):

````text
Color Palette

BRAND

Copy
Highlighter Mint
#e2ffcc
Primary brand accent — display text, nav links, button labels, icon fills. The signature color; reads as highlighter pen on topo map

NEUTRALS

Copy
Pure Black
#000000
Icon strokes, link underlines, high-contrast accents where maximum punch is needed
Copy
Carbon Ink
#161b13
Dark section backgrounds — near-black with the faintest green undertone, anchors the dark bands of the page
Copy
Forest Charcoal
#2d3329
Mid-dark text and borders on light sections — softer than pure black, keeps the green-warmth consistent
Copy
Sage Stone
#84907f
Muted secondary accent — subtle background washes, subdued UI elements where Highlighter Mint would be too loud
Copy
Topo Gray
#dde2e4
Light section backgrounds, card surfaces, hairlines — the base canvas for light bands
````

Token table from DESIGN.md (verbatim):

| Name | Value | Token | Role |
|------|-------|-------|------|
| Highlighter Mint | `#e2ffcc` | `--color-highlighter-mint` | Primary brand accent — display text, nav links, button labels, icon fills. The signature color; reads as highlighter pen on topo map |
| Sage Stone | `#84907f` | `--color-sage-stone` | Muted secondary accent — subtle background washes, subdued UI elements where Highlighter Mint would be too loud |
| Carbon Ink | `#161b13` | `--color-carbon-ink` | Dark section backgrounds — near-black with the faintest green undertone, anchors the dark bands of the page |
| Forest Charcoal | `#2d3329` | `--color-forest-charcoal` | Mid-dark text and borders on light sections — softer than pure black, keeps the green-warmth consistent |
| Topo Gray | `#dde2e4` | `--color-topo-gray` | Light section backgrounds, card surfaces, hairlines — the base canvas for light bands |
| Pure Black | `#000000` | `--color-pure-black` | Icon strokes, link underlines, high-contrast accents where maximum punch is needed |

Surfaces (verbatim from DESIGN.md):

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Topo Gray | `#dde2e4` | Light page canvas and card base |
| 1 | Highlighter Mint | `#e2ffcc` | Accent surface for highlighted text blocks and tonal emphasis |
| 2 | Sage Stone | `#84907f` | Mid-tone surface for subdued sections |
| 3 | Forest Charcoal | `#2d3329` | Deep UI surface on light themes |
| 4 | Carbon Ink | `#161b13` | Dark section background — alternate page band |

### Typography

Typography section as rendered on the page, type scale expanded via 'Show all' (verbatim innerText):

````text
Typography

TYPE SCALE

Major Second (1.125) from 16px base

display
366px · 400 · 0.9
THE QUICK BROWN FOX JUMPS
heading
48px · 400 · 0.9
THE QUICK BROWN FOX JUMPS
subheading
40px · 400 · 0.9
THE QUICK BROWN FOX JUMPS
16px
16px · 400 · 1.2
The quick brown fox jumps
16px
16px · 400 · 1.2
The quick brown fox jumps
16px
16px · 400 · 1.2
THE QUICK BROWN FOX JUMPS
16px
16px · 400 · 1.2
THE QUICK BROWN FOX JUMPS
16px
16px · 400 · 1.2
The Quick Brown Fox Jumps
16px
16px · 400 · 1.2
The quick brown fox jumps
16px
16px · 700 · 1.2
THE QUICK BROWN FOX JUMPS
12px
12px · 400 · 1.2
THE QUICK BROWN FOX JUMPS
10px
10px · 700 · 1.2
THE QUICK BROWN FOX JUMPS
10px
10px · 400 · 1.2
The Quick Brown Fox Jumps
10px
10px · 400 · 1.2
The quick brown fox jumps
Show less

FONTS

DISPLAY
F37stout
Weight
400
Sizes
40px, 48px, 366px
Line height
0.90
Letter spacing
normal
Fallback
Bebas Neue, Anton, Oswald

Display face for section openers and brand wordmark. The extreme condensed proportions at 0.90 line-height and a single weight (400) create landscape-blocking headlines that read as stamped signage, not web type. At 366px it fills the viewport; at 40–48px it becomes a tight sectional label.

CODE
mono
Weight
400, 700
Sizes
10px, 12px, 16px
Line height
1.20
Letter spacing
-0.01em
Fallback
JetBrains Mono, IBM Plex Mono, Space Mono

All UI chrome, body copy, nav, captions, buttons, footer text. The -0.01em tracking and tight 1.20 line-height give it a screen-printed, field-guide density. Weight 700 is used sparingly for emphasis; weight 400 carries the load. All-caps treatments dominate — this face behaves like a typewriter.

BODY
Times
Weight
400
Sizes
16px
Line height
1.20
Letter spacing
normal
Fallback
Times New Roman, any system serif

Serif accent for inline links, providing a newspaper/editorial contrast against the mono body. Used sparingly — one or two link moments per page.
````

Typography tokens from DESIGN.md (verbatim):

#### F37stout — Display face for section openers and brand wordmark. The extreme condensed proportions at 0.90 line-height and a single weight (400) create landscape-blocking headlines that read as stamped signage, not web type. At 366px it fills the viewport; at 40–48px it becomes a tight sectional label. · `--font-f37stout`
- **Substitute:** Bebas Neue, Anton, Oswald
- **Weights:** 400
- **Sizes:** 40px, 48px, 366px
- **Line height:** 0.90
- **Letter spacing:** normal
- **Role:** Display face for section openers and brand wordmark. The extreme condensed proportions at 0.90 line-height and a single weight (400) create landscape-blocking headlines that read as stamped signage, not web type. At 366px it fills the viewport; at 40–48px it becomes a tight sectional label.

#### mono — All UI chrome, body copy, nav, captions, buttons, footer text. The -0.01em tracking and tight 1.20 line-height give it a screen-printed, field-guide density. Weight 700 is used sparingly for emphasis; weight 400 carries the load. All-caps treatments dominate — this face behaves like a typewriter. · `--font-mono`
- **Substitute:** JetBrains Mono, IBM Plex Mono, Space Mono
- **Weights:** 400, 700
- **Sizes:** 10px, 12px, 16px
- **Line height:** 1.20
- **Letter spacing:** -0.01em
- **Role:** All UI chrome, body copy, nav, captions, buttons, footer text. The -0.01em tracking and tight 1.20 line-height give it a screen-printed, field-guide density. Weight 700 is used sparingly for emphasis; weight 400 carries the load. All-caps treatments dominate — this face behaves like a typewriter.

#### Times — Serif accent for inline links, providing a newspaper/editorial contrast against the mono body. Used sparingly — one or two link moments per page. · `--font-times`
- **Substitute:** Times New Roman, any system serif
- **Weights:** 400
- **Sizes:** 16px
- **Line height:** 1.20
- **Letter spacing:** normal
- **Role:** Serif accent for inline links, providing a newspaper/editorial contrast against the mono body. Used sparingly — one or two link moments per page.

#### Type Scale

| Role | Family | Weight | Size | Line Height | Letter Spacing | Token |
|------|--------|--------|------|-------------|----------------|-------|
| caption | — | — | 10px | 1.2 | -0.01px | `--text-caption` |
| body | — | — | 16px | 1.2 | -0.01px | `--text-body` |
| subheading | — | — | 40px | 0.9 | — | `--text-subheading` |
| heading | — | — | 48px | 0.9 | — | `--text-heading` |
| display | — | — | 366px | 0.9 | — | `--text-display` |

### Spacing and layout

Spacing & Shape section as rendered on the page (verbatim innerText; preview column is visual only):

````text
Spacing & Shape

SPACING

Purpose	Value	Preview
Density	comfortable
	
Base unit	6px
	

Section gap	67px
	

Card padding	16px
	

Element gap	24px
	

BORDER RADIUS

Element	Value	Preview
````

Spacing and shape tokens from DESIGN.md (verbatim):

**Base unit:** 6px

**Density:** comfortable

#### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 5 | 5px | `--spacing-5` |
| 12 | 12px | `--spacing-12` |
| 16 | 16px | `--spacing-16` |
| 24 | 24px | `--spacing-24` |
| 40 | 40px | `--spacing-40` |
| 67 | 67px | `--spacing-67` |
| 70 | 70px | `--spacing-70` |
| 190 | 190px | `--spacing-190` |

#### Border Radius

| Element | Value |
|---------|-------|
| tags | 0px |
| cards | 0px |
| buttons | 0px |

#### Layout

- **Section gap:** 67px
- **Card padding:** 16px
- **Element gap:** 24px

Layout (verbatim from DESIGN.md):

> Full-bleed edge-to-edge layout with no max-width container — the canvas stretches to viewport edges on all sections. Hero pattern: full-viewport landscape photograph with the massive display headline overlapping the lower portion of the image. Section rhythm alternates between photographic/light bands and solid dark bands (#161b13), each spanning full width. Dark sections feature asymmetric, hand-scattered photo clusters rather than grids. Navigation is a minimal top bar — wordmark left, single outlined button right — with no sticky behavior apparent. Content arrangement is deliberately non-grid: photos are rotated and overlapping, text blocks sit at irregular margins (67px, 70px, 190px observed), creating a journal/zine composition rather than a SaaS dashboard. No card grids, no pricing tables, no feature matrices. Generous breathing room between sections (67–70px) but tight internal spacing (12–24px).

### Shape and depth

Radii per element (from DESIGN.md Border Radius table):

- tags: 0px
- cards: 0px
- buttons: 0px

Elevation (verbatim from DESIGN.md):

> No shadows, no drop shadows, no glow effects. Depth is created entirely through the layered overlap of photographic elements on solid color backgrounds, and through the surface scale from Topo Gray through Carbon Ink. The flatness is deliberate — it reads as printed paper, not digital UI.

Shadow values: none on the page (style is explicitly shadowless; no shadow tokens in any export).

Imagery (verbatim from DESIGN.md):

> Photography is the primary visual content — expansive landscape shots of canyons, mountains, and fly-fishing environments, treated as full-bleed hero backgrounds without color grading or filters. Tonal range is warm golden-hour to cool dusk. Secondary imagery appears as scattered, hand-tilted Polaroid-style snapshots (rotated -12° to +12°) on dark sections, creating a scrapbook/zine aesthetic. No illustrations, no product renders, no abstract graphics. The only non-photographic visual is simple line-drawn icon badges (hat, house, location markers) in 1.5px stroke. Photography occupies roughly 60% of total page real estate — image-heavy overall, with text punctuating rather than dominating.

### Components

Named components: Brand Wordmark, Outlined Nav Button, Display Headline, Tilted Photo Card, Circular Icon Badge, Footer Caption Block, Section Band — Dark, Section Band — Light, Inline Link, Scroll Cue Indicator.

Components section (verbatim from DESIGN.md):

#### Brand Wordmark
**Role:** Logo lockup in the top-left corner

Custom display face (F37stout equivalent) reading 'San Rita' at approximately 40px. Color is Highlighter Mint (#e2ffcc) on dark sections, Forest Charcoal (#2d3329) on light sections. No icon, no container — just the wordmark as a direct stamp.

#### Outlined Nav Button
**Role:** Primary navigation CTA in the header (e.g. 'SHOW TRAILS')

1px solid border in current text color, transparent fill, 0px radius, 12–16px horizontal padding, mono caps at 10–12px. Sits flush right in the header. On dark backgrounds: border and text in Highlighter Mint (#e2ffcc). On light backgrounds: border and text in Forest Charcoal (#2d3329).

#### Display Headline
**Role:** Section-opener text that fills the viewport

F37stout at 366px, line-height 0.90, letter-spacing normal, weight 400. Set in Highlighter Mint (#e2ffcc) and overlaps photographic backgrounds. The extreme scale means one line of text occupies the full width — the headline IS the layout, not contained within it.

#### Tilted Photo Card
**Role:** Scrapbook-style image cluster on dark sections

Photographs at roughly 280–360px wide, set at varying rotation angles (approximately -8°, +12°, +4°) to create a hand-scattered, Polaroid-tossed effect. No border, no shadow, no radius — raw 0px corners. Overlaps and partially covers neighboring images. Sits on Carbon Ink (#161b13) background.

#### Circular Icon Badge
**Role:** Standalone illustrated icon pinned to sections

Small circular badge (approximately 40–48px diameter) with a 1.5px stroke outline in Highlighter Mint (#e2ffcc), transparent fill. Contains a simple line illustration (e.g. hat, house, location pin). Functions as a decorative marker — not interactive chrome.

#### Footer Caption Block
**Role:** Small all-caps location/credit text in the lower-right

Mono 10–12px, line-height 1.20, letter-spacing -0.01em, color Highlighter Mint (#e2ffcc) on dark. All-caps. Two to three short lines of geographical/brand lineage copy. Right-aligned, sits near the bottom edge with generous margin (190px+ from one side).

#### Section Band — Dark
**Role:** Full-bleed dark content band

Background Carbon Ink (#161b13), spans full viewport width, no max-width constraint. Contains scattered tilted photo cards, icon badges, and Highlighter Mint text. Section padding is roughly 67–70px top/bottom.

#### Section Band — Light
**Role:** Full-bleed light content band

Background Topo Gray (#dde2e4) or photographic. Mono body text in Forest Charcoal (#2d3329). Section padding 67–70px. Often the top band under a full-bleed photographic hero.

#### Inline Link
**Role:** Text links within body copy

Serif (Times) at 16px, underline present, color Forest Charcoal (#2d3329) on light backgrounds. The only serif moment in the system — reads as editorial anchor text.

#### Scroll Cue Indicator
**Role:** Small fixed element near bottom of viewport

Tiny circular or hexagonal icon (approximately 24px) with 1px stroke in Forest Charcoal (#2d3329) or Highlighter Mint (#e2ffcc). Suggests downward scroll direction. No fill, no animation chrome — a quiet directional hint.

Agent Prompt Guide (verbatim from DESIGN.md):

````markdown
## Quick Color Reference
- text: #2d3329 (on light) / #e2ffcc (on dark)
- background: #dde2e4 (light) / #161b13 (dark)
- border: #2d3329 (on light) / #e2ffcc (on dark)
- accent: #e2ffcc (Highlighter Mint)
- primary action: no distinct CTA color

## 3 Example Component Prompts

### 1. Outlined Ghost Nav Button
Create a nav button: 1px solid #e2ffcc border, transparent fill, 0px radius, 12px 16px padding. Text: 'SHOW TRAILS' in mono 10px, weight 400, letter-spacing -0.01em, color #e2ffcc, all-caps. No background fill — the border IS the affordance.

### 2. Display Headline Over Photography
Create a section with a full-bleed landscape photograph as background. Overlap it with a headline: F37stout (use Bebas Neue as substitute) at 366px, weight 400, line-height 0.90, color #e2ffcc, letter-spacing normal. Text should fill the viewport width on a single line, anchored to the lower third of the image.

### 3. Tilted Photo Cluster on Dark Band
Create a dark section: background #161b13, padding 67px top/bottom. Inside, place three photograph cards (280–360px wide) at rotation angles of -8°, +12°, and +4°, with slight overlap. Images: outdoor landscape/fly-fishing photography. No border, no radius, no shadow. Add a small circular icon badge (1.5px stroke #e2ffcc, 48px diameter) floating in the upper-left quadrant.

## Photo Composition Rules

Tilted photo clusters follow these rules:
- Rotation range: -12° to +12°, never beyond
- Cards overlap by approximately 15–25% of their width
- No two adjacent photos share the same angle
- All photos share the same warm color treatment — no black-and-white breaks
- The cluster is always asymmetric — never a centered, balanced stack
- The dark background (#161b13) is visible in the gaps between photos, defining the negative space
````

### Guidelines

DO (verbatim):

- Use F37stout for display moments only — let 366px headlines own the viewport, never shrink below 40px
- Set all display text in Highlighter Mint (#e2ffcc) and let it overlap photographic backgrounds
- Keep line-height at 0.90 for all F37stout type — the extreme tightness is the signature
- Use mono (system mono substitute) at 10/12/16px for all UI, body, and caption text with -0.01em tracking
- Set section gaps at 67–70px and element gaps at 24px — the rhythm comes from the 6px base unit scaled up
- Scatter tilted photo cards at varying rotation angles (-12° to +12°) on Carbon Ink (#161b13) backgrounds
- Keep radius at 0px for all components — corners stay sharp, the design language is topo-map crisp

DON'T (verbatim):

- Don't add border-radius to buttons, cards, or images — sharp corners are non-negotiable
- Don't use a second chromatic accent — Highlighter Mint is the only color moment that carries brand
- Don't set F37stout at intermediate sizes (16–36px) — it only works at display scale or subheading scale (40–48px)
- Don't use Times for body copy — it's a link accent only, the rest of the system is mono
- Don't apply shadows or elevation — surfaces are defined purely by color and photographic layering
- Don't center body text — mono UI copy should sit left-aligned or right-aligned, never centered
- Don't introduce a third neutral — the five-tone scale (#dde2e4 → #84907f → #2d3329 → #161b13 → #000000) is the complete tonal range

### Similar brands

Similar Brands (verbatim from DESIGN.md):

- **Topo Designs** — Same outdoor-brand full-bleed photography, condensed display type, and minimal chrome — both treat the website as a lookbook rather than a store
- **Patagonia** — Landscape-first hero imagery with environmental storytelling, though San Rita is more zine-scrapbook and less editorial
- **Rumpl** — Same utilitarian mono UI type, photographic full-bleed sections, and topographic/field-guide visual language
- **Poler** — Hand-tilted photo collage aesthetic, dark-and-photo alternating sections, casual outdoor brand attitude over polished e-commerce
- **Snow Peak** — Minimal nav chrome, landscape photography dominance, and typography that prioritizes display moments over body text density

'More like this' cards on the page (name — truncated card tagline, as shown):

- Zipline — open meadow in morning light
- Aker — darkroom gallery wall Monumental…
- Peak Design — Gallery wall, half lit
- Lightship — Cinematic open-road diorama. Warm…
- A-WARE — Apothecary editorial on warm…
- ALSO — Bicycle zine on cream paper
- Adaline — botanist's specimen journal beside…
- Alpine Hearing Protection — Sunlit Scandinavian editorial. A…
- Visual — Warm editorial zine. Cream paper,…
- 11x– Digital workers — Cinematic editorial desert —…
- Steep — serif analytics on warm paper
- LE CAMP — Alpine summit base camp at dusk —…
- Arva — Pastoral editorial magazine spread…
- Hey Low — botanical field journal on cream…
- Alpine Bio — Sun-drenched botanical apothecary…
- Home — Warm editorial atelier. Cream…
- Evergreen — Sunlit greenhouse on linen paper
- Peggy — monochrome art gallery on a winter…
- Felt — topographic atlas at dusk —…
- Vanmoof — cinematic monochrome showroom

### Exports

Each export tab has Compact and Extended modes; both are recorded verbatim.

#### DESIGN.md — Extended (verbatim)

````markdown
# San Rita — Style Reference
> alpine field guide on sage paper

**Theme:** mixed

Source measurements are normalized; roles and recommendations are interpreted. Font summary lists are independent, not paired by position. HTML examples are reconstructions, not source components.

San Rita reads like a field journal for an outdoor boot brand: expansive landscape photography, a single pale mint accent that pops like highlighter on topo paper, and a custom condensed display face that turns section openers into landscape-blocking statements. The visual rhythm alternates between bright, full-bleed imagery and near-black (#161b13) dark bands where tilted Polaroid-style photos scatter across the canvas like a fly-fishing logbook. Typography is utilitarian and small for everything except the display moments — mono caps handle UI chrome while a single massive 300px+ display line carries each section's identity. Components stay flat and unembellished: thin outlined buttons, no shadows, no rounded corners to soften the edges. The whole system feels like topographic map meets adventure zine — confident, outdoorsy, and deliberately raw rather than polished SaaS.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Highlighter Mint | `#e2ffcc` | `--color-highlighter-mint` | Primary brand accent — display text, nav links, button labels, icon fills. The signature color; reads as highlighter pen on topo map |
| Sage Stone | `#84907f` | `--color-sage-stone` | Muted secondary accent — subtle background washes, subdued UI elements where Highlighter Mint would be too loud |
| Carbon Ink | `#161b13` | `--color-carbon-ink` | Dark section backgrounds — near-black with the faintest green undertone, anchors the dark bands of the page |
| Forest Charcoal | `#2d3329` | `--color-forest-charcoal` | Mid-dark text and borders on light sections — softer than pure black, keeps the green-warmth consistent |
| Topo Gray | `#dde2e4` | `--color-topo-gray` | Light section backgrounds, card surfaces, hairlines — the base canvas for light bands |
| Pure Black | `#000000` | `--color-pure-black` | Icon strokes, link underlines, high-contrast accents where maximum punch is needed |

## Tokens — Typography

### F37stout — Display face for section openers and brand wordmark. The extreme condensed proportions at 0.90 line-height and a single weight (400) create landscape-blocking headlines that read as stamped signage, not web type. At 366px it fills the viewport; at 40–48px it becomes a tight sectional label. · `--font-f37stout`
- **Substitute:** Bebas Neue, Anton, Oswald
- **Weights:** 400
- **Sizes:** 40px, 48px, 366px
- **Line height:** 0.90
- **Letter spacing:** normal
- **Role:** Display face for section openers and brand wordmark. The extreme condensed proportions at 0.90 line-height and a single weight (400) create landscape-blocking headlines that read as stamped signage, not web type. At 366px it fills the viewport; at 40–48px it becomes a tight sectional label.

### mono — All UI chrome, body copy, nav, captions, buttons, footer text. The -0.01em tracking and tight 1.20 line-height give it a screen-printed, field-guide density. Weight 700 is used sparingly for emphasis; weight 400 carries the load. All-caps treatments dominate — this face behaves like a typewriter. · `--font-mono`
- **Substitute:** JetBrains Mono, IBM Plex Mono, Space Mono
- **Weights:** 400, 700
- **Sizes:** 10px, 12px, 16px
- **Line height:** 1.20
- **Letter spacing:** -0.01em
- **Role:** All UI chrome, body copy, nav, captions, buttons, footer text. The -0.01em tracking and tight 1.20 line-height give it a screen-printed, field-guide density. Weight 700 is used sparingly for emphasis; weight 400 carries the load. All-caps treatments dominate — this face behaves like a typewriter.

### Times — Serif accent for inline links, providing a newspaper/editorial contrast against the mono body. Used sparingly — one or two link moments per page. · `--font-times`
- **Substitute:** Times New Roman, any system serif
- **Weights:** 400
- **Sizes:** 16px
- **Line height:** 1.20
- **Letter spacing:** normal
- **Role:** Serif accent for inline links, providing a newspaper/editorial contrast against the mono body. Used sparingly — one or two link moments per page.

### Type Scale

| Role | Family | Weight | Size | Line Height | Letter Spacing | Token |
|------|--------|--------|------|-------------|----------------|-------|
| caption | — | — | 10px | 1.2 | -0.01px | `--text-caption` |
| body | — | — | 16px | 1.2 | -0.01px | `--text-body` |
| subheading | — | — | 40px | 0.9 | — | `--text-subheading` |
| heading | — | — | 48px | 0.9 | — | `--text-heading` |
| display | — | — | 366px | 0.9 | — | `--text-display` |

## Tokens — Spacing & Shapes

**Base unit:** 6px

**Density:** comfortable

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 5 | 5px | `--spacing-5` |
| 12 | 12px | `--spacing-12` |
| 16 | 16px | `--spacing-16` |
| 24 | 24px | `--spacing-24` |
| 40 | 40px | `--spacing-40` |
| 67 | 67px | `--spacing-67` |
| 70 | 70px | `--spacing-70` |
| 190 | 190px | `--spacing-190` |

### Border Radius

| Element | Value |
|---------|-------|
| tags | 0px |
| cards | 0px |
| buttons | 0px |

### Layout

- **Section gap:** 67px
- **Card padding:** 16px
- **Element gap:** 24px

## Components

### Brand Wordmark
**Role:** Logo lockup in the top-left corner

Custom display face (F37stout equivalent) reading 'San Rita' at approximately 40px. Color is Highlighter Mint (#e2ffcc) on dark sections, Forest Charcoal (#2d3329) on light sections. No icon, no container — just the wordmark as a direct stamp.

### Outlined Nav Button
**Role:** Primary navigation CTA in the header (e.g. 'SHOW TRAILS')

1px solid border in current text color, transparent fill, 0px radius, 12–16px horizontal padding, mono caps at 10–12px. Sits flush right in the header. On dark backgrounds: border and text in Highlighter Mint (#e2ffcc). On light backgrounds: border and text in Forest Charcoal (#2d3329).

### Display Headline
**Role:** Section-opener text that fills the viewport

F37stout at 366px, line-height 0.90, letter-spacing normal, weight 400. Set in Highlighter Mint (#e2ffcc) and overlaps photographic backgrounds. The extreme scale means one line of text occupies the full width — the headline IS the layout, not contained within it.

### Tilted Photo Card
**Role:** Scrapbook-style image cluster on dark sections

Photographs at roughly 280–360px wide, set at varying rotation angles (approximately -8°, +12°, +4°) to create a hand-scattered, Polaroid-tossed effect. No border, no shadow, no radius — raw 0px corners. Overlaps and partially covers neighboring images. Sits on Carbon Ink (#161b13) background.

### Circular Icon Badge
**Role:** Standalone illustrated icon pinned to sections

Small circular badge (approximately 40–48px diameter) with a 1.5px stroke outline in Highlighter Mint (#e2ffcc), transparent fill. Contains a simple line illustration (e.g. hat, house, location pin). Functions as a decorative marker — not interactive chrome.

### Footer Caption Block
**Role:** Small all-caps location/credit text in the lower-right

Mono 10–12px, line-height 1.20, letter-spacing -0.01em, color Highlighter Mint (#e2ffcc) on dark. All-caps. Two to three short lines of geographical/brand lineage copy. Right-aligned, sits near the bottom edge with generous margin (190px+ from one side).

### Section Band — Dark
**Role:** Full-bleed dark content band

Background Carbon Ink (#161b13), spans full viewport width, no max-width constraint. Contains scattered tilted photo cards, icon badges, and Highlighter Mint text. Section padding is roughly 67–70px top/bottom.

### Section Band — Light
**Role:** Full-bleed light content band

Background Topo Gray (#dde2e4) or photographic. Mono body text in Forest Charcoal (#2d3329). Section padding 67–70px. Often the top band under a full-bleed photographic hero.

### Inline Link
**Role:** Text links within body copy

Serif (Times) at 16px, underline present, color Forest Charcoal (#2d3329) on light backgrounds. The only serif moment in the system — reads as editorial anchor text.

### Scroll Cue Indicator
**Role:** Small fixed element near bottom of viewport

Tiny circular or hexagonal icon (approximately 24px) with 1px stroke in Forest Charcoal (#2d3329) or Highlighter Mint (#e2ffcc). Suggests downward scroll direction. No fill, no animation chrome — a quiet directional hint.

## Do's and Don'ts

### Do
- Use F37stout for display moments only — let 366px headlines own the viewport, never shrink below 40px
- Set all display text in Highlighter Mint (#e2ffcc) and let it overlap photographic backgrounds
- Keep line-height at 0.90 for all F37stout type — the extreme tightness is the signature
- Use mono (system mono substitute) at 10/12/16px for all UI, body, and caption text with -0.01em tracking
- Set section gaps at 67–70px and element gaps at 24px — the rhythm comes from the 6px base unit scaled up
- Scatter tilted photo cards at varying rotation angles (-12° to +12°) on Carbon Ink (#161b13) backgrounds
- Keep radius at 0px for all components — corners stay sharp, the design language is topo-map crisp

### Don't
- Don't add border-radius to buttons, cards, or images — sharp corners are non-negotiable
- Don't use a second chromatic accent — Highlighter Mint is the only color moment that carries brand
- Don't set F37stout at intermediate sizes (16–36px) — it only works at display scale or subheading scale (40–48px)
- Don't use Times for body copy — it's a link accent only, the rest of the system is mono
- Don't apply shadows or elevation — surfaces are defined purely by color and photographic layering
- Don't center body text — mono UI copy should sit left-aligned or right-aligned, never centered
- Don't introduce a third neutral — the five-tone scale (#dde2e4 → #84907f → #2d3329 → #161b13 → #000000) is the complete tonal range

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Topo Gray | `#dde2e4` | Light page canvas and card base |
| 1 | Highlighter Mint | `#e2ffcc` | Accent surface for highlighted text blocks and tonal emphasis |
| 2 | Sage Stone | `#84907f` | Mid-tone surface for subdued sections |
| 3 | Forest Charcoal | `#2d3329` | Deep UI surface on light themes |
| 4 | Carbon Ink | `#161b13` | Dark section background — alternate page band |

## Elevation

No shadows, no drop shadows, no glow effects. Depth is created entirely through the layered overlap of photographic elements on solid color backgrounds, and through the surface scale from Topo Gray through Carbon Ink. The flatness is deliberate — it reads as printed paper, not digital UI.

## Imagery

Photography is the primary visual content — expansive landscape shots of canyons, mountains, and fly-fishing environments, treated as full-bleed hero backgrounds without color grading or filters. Tonal range is warm golden-hour to cool dusk. Secondary imagery appears as scattered, hand-tilted Polaroid-style snapshots (rotated -12° to +12°) on dark sections, creating a scrapbook/zine aesthetic. No illustrations, no product renders, no abstract graphics. The only non-photographic visual is simple line-drawn icon badges (hat, house, location markers) in 1.5px stroke. Photography occupies roughly 60% of total page real estate — image-heavy overall, with text punctuating rather than dominating.

## Layout

Full-bleed edge-to-edge layout with no max-width container — the canvas stretches to viewport edges on all sections. Hero pattern: full-viewport landscape photograph with the massive display headline overlapping the lower portion of the image. Section rhythm alternates between photographic/light bands and solid dark bands (#161b13), each spanning full width. Dark sections feature asymmetric, hand-scattered photo clusters rather than grids. Navigation is a minimal top bar — wordmark left, single outlined button right — with no sticky behavior apparent. Content arrangement is deliberately non-grid: photos are rotated and overlapping, text blocks sit at irregular margins (67px, 70px, 190px observed), creating a journal/zine composition rather than a SaaS dashboard. No card grids, no pricing tables, no feature matrices. Generous breathing room between sections (67–70px) but tight internal spacing (12–24px).

## Agent Prompt Guide

## Quick Color Reference
- text: #2d3329 (on light) / #e2ffcc (on dark)
- background: #dde2e4 (light) / #161b13 (dark)
- border: #2d3329 (on light) / #e2ffcc (on dark)
- accent: #e2ffcc (Highlighter Mint)
- primary action: no distinct CTA color

## 3 Example Component Prompts

### 1. Outlined Ghost Nav Button
Create a nav button: 1px solid #e2ffcc border, transparent fill, 0px radius, 12px 16px padding. Text: 'SHOW TRAILS' in mono 10px, weight 400, letter-spacing -0.01em, color #e2ffcc, all-caps. No background fill — the border IS the affordance.

### 2. Display Headline Over Photography
Create a section with a full-bleed landscape photograph as background. Overlap it with a headline: F37stout (use Bebas Neue as substitute) at 366px, weight 400, line-height 0.90, color #e2ffcc, letter-spacing normal. Text should fill the viewport width on a single line, anchored to the lower third of the image.

### 3. Tilted Photo Cluster on Dark Band
Create a dark section: background #161b13, padding 67px top/bottom. Inside, place three photograph cards (280–360px wide) at rotation angles of -8°, +12°, and +4°, with slight overlap. Images: outdoor landscape/fly-fishing photography. No border, no radius, no shadow. Add a small circular icon badge (1.5px stroke #e2ffcc, 48px diameter) floating in the upper-left quadrant.

## Photo Composition Rules

Tilted photo clusters follow these rules:
- Rotation range: -12° to +12°, never beyond
- Cards overlap by approximately 15–25% of their width
- No two adjacent photos share the same angle
- All photos share the same warm color treatment — no black-and-white breaks
- The cluster is always asymmetric — never a centered, balanced stack
- The dark background (#161b13) is visible in the gaps between photos, defining the negative space

## Similar Brands

- **Topo Designs** — Same outdoor-brand full-bleed photography, condensed display type, and minimal chrome — both treat the website as a lookbook rather than a store
- **Patagonia** — Landscape-first hero imagery with environmental storytelling, though San Rita is more zine-scrapbook and less editorial
- **Rumpl** — Same utilitarian mono UI type, photographic full-bleed sections, and topographic/field-guide visual language
- **Poler** — Hand-tilted photo collage aesthetic, dark-and-photo alternating sections, casual outdoor brand attitude over polished e-commerce
- **Snow Peak** — Minimal nav chrome, landscape photography dominance, and typography that prioritizes display moments over body text density

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-highlighter-mint: #e2ffcc;
  --color-sage-stone: #84907f;
  --color-carbon-ink: #161b13;
  --color-forest-charcoal: #2d3329;
  --color-topo-gray: #dde2e4;
  --color-pure-black: #000000;

  /* Typography — Font Families */
  --font-f37stout: 'F37stout', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: 'mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --font-times: 'Times', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 10px;
  --leading-caption: 1.2;
  --tracking-caption: -0.01px;
  --text-body: 16px;
  --leading-body: 1.2;
  --tracking-body: -0.01px;
  --text-subheading: 40px;
  --leading-subheading: 0.9;
  --text-heading: 48px;
  --leading-heading: 0.9;
  --text-display: 366px;
  --leading-display: 0.9;

  /* Typography — Weights */
  --font-weight-regular: 400;
  --font-weight-bold: 700;

  /* Spacing */
  --spacing-unit: 6px;
  --spacing-5: 5px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-24: 24px;
  --spacing-40: 40px;
  --spacing-67: 67px;
  --spacing-70: 70px;
  --spacing-190: 190px;

  /* Layout */
  --section-gap: 67px;
  --card-padding: 16px;
  --element-gap: 24px;

  /* Named Radii */
  --radius-tags: 0px;
  --radius-cards: 0px;
  --radius-buttons: 0px;

  /* Surfaces */
  --surface-topo-gray: #dde2e4;
  --surface-highlighter-mint: #e2ffcc;
  --surface-sage-stone: #84907f;
  --surface-forest-charcoal: #2d3329;
  --surface-carbon-ink: #161b13;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-highlighter-mint: #e2ffcc;
  --color-sage-stone: #84907f;
  --color-carbon-ink: #161b13;
  --color-forest-charcoal: #2d3329;
  --color-topo-gray: #dde2e4;
  --color-pure-black: #000000;

  /* Typography */
  --font-f37stout: 'F37stout', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: 'mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --font-times: 'Times', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 10px;
  --leading-caption: 1.2;
  --tracking-caption: -0.01px;
  --text-body: 16px;
  --leading-body: 1.2;
  --tracking-body: -0.01px;
  --text-subheading: 40px;
  --leading-subheading: 0.9;
  --text-heading: 48px;
  --leading-heading: 0.9;
  --text-display: 366px;
  --leading-display: 0.9;

  /* Spacing */
  --spacing-5: 5px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-24: 24px;
  --spacing-40: 40px;
  --spacing-67: 67px;
  --spacing-70: 70px;
  --spacing-190: 190px;
}
```
````

#### DESIGN.md — Compact (verbatim)

<details><summary>Show compact DESIGN.md</summary>

````markdown
# San Rita — Style Reference
> alpine field guide on sage paper

**Theme:** mixed

Source measurements are normalized; roles and recommendations are interpreted. Font summary lists are independent, not paired by position. HTML examples are reconstructions, not source components.

San Rita reads like a field journal for an outdoor boot brand: expansive landscape photography, a single pale mint accent that pops like highlighter on topo paper, and a custom condensed display face that turns section openers into landscape-blocking statements. The visual rhythm alternates between bright, full-bleed imagery and near-black (#161b13) dark bands where tilted Polaroid-style photos scatter across the canvas like a fly-fishing logbook. Typography is utilitarian and small for everything except the display moments — mono caps handle UI chrome while a single massive 300px+ display line carries each section's identity. Components stay flat and unembellished: thin outlined buttons, no shadows, no rounded corners to soften the edges. The whole system feels like topographic map meets adventure zine — confident, outdoorsy, and deliberately raw rather than polished SaaS.

## Colors

| Name | Value | Role |
|------|-------|------|
| Highlighter Mint | `#e2ffcc` | Primary brand accent — display text, nav links, button labels, icon fills. The signature color; reads as highlighter pen on topo map |
| Sage Stone | `#84907f` | Muted secondary accent — subtle background washes, subdued UI elements where Highlighter Mint would be too loud |
| Carbon Ink | `#161b13` | Dark section backgrounds — near-black with the faintest green undertone, anchors the dark bands of the page |
| Forest Charcoal | `#2d3329` | Mid-dark text and borders on light sections — softer than pure black, keeps the green-warmth consistent |
| Topo Gray | `#dde2e4` | Light section backgrounds, card surfaces, hairlines — the base canvas for light bands |
| Pure Black | `#000000` | Icon strokes, link underlines, high-contrast accents where maximum punch is needed |

## Typography

### F37stout — Display face for section openers and brand wordmark. The extreme condensed proportions at 0.90 line-height and a single weight (400) create landscape-blocking headlines that read as stamped signage, not web type. At 366px it fills the viewport; at 40–48px it becomes a tight sectional label.
- **Substitute:** Bebas Neue, Anton, Oswald
- **Weights:** 400
- **Sizes:** 40px, 48px, 366px
- **Line height:** 0.90
- **Letter spacing:** normal

### mono — All UI chrome, body copy, nav, captions, buttons, footer text. The -0.01em tracking and tight 1.20 line-height give it a screen-printed, field-guide density. Weight 700 is used sparingly for emphasis; weight 400 carries the load. All-caps treatments dominate — this face behaves like a typewriter.
- **Substitute:** JetBrains Mono, IBM Plex Mono, Space Mono
- **Weights:** 400, 700
- **Sizes:** 10px, 12px, 16px
- **Line height:** 1.20
- **Letter spacing:** -0.01em

### Times — Serif accent for inline links, providing a newspaper/editorial contrast against the mono body. Used sparingly — one or two link moments per page.
- **Substitute:** Times New Roman, any system serif
- **Weights:** 400
- **Sizes:** 16px
- **Line height:** 1.20
- **Letter spacing:** normal

### Type Scale

| Role | Family | Weight | Size | Line Height | Letter Spacing |
|------|--------|--------|------|-------------|----------------|
| caption | — | — | 10px | 1.2 | -0.01px |
| body | — | — | 16px | 1.2 | -0.01px |
| subheading | — | — | 40px | 0.9 | — |
| heading | — | — | 48px | 0.9 | — |
| display | — | — | 366px | 0.9 | — |

## Spacing & Layout

**Base unit:** 6px

**Density:** comfortable

- **Section gap:** 67px
- **Card padding:** 16px
- **Element gap:** 24px

### Border Radius

- **tags:** 0px
- **cards:** 0px
- **buttons:** 0px

## Components

### Brand Wordmark
**Role:** Logo lockup in the top-left corner

Custom display face (F37stout equivalent) reading 'San Rita' at approximately 40px. Color is Highlighter Mint (#e2ffcc) on dark sections, Forest Charcoal (#2d3329) on light sections. No icon, no container — just the wordmark as a direct stamp.

### Outlined Nav Button
**Role:** Primary navigation CTA in the header (e.g. 'SHOW TRAILS')

1px solid border in current text color, transparent fill, 0px radius, 12–16px horizontal padding, mono caps at 10–12px. Sits flush right in the header. On dark backgrounds: border and text in Highlighter Mint (#e2ffcc). On light backgrounds: border and text in Forest Charcoal (#2d3329).

### Display Headline
**Role:** Section-opener text that fills the viewport

F37stout at 366px, line-height 0.90, letter-spacing normal, weight 400. Set in Highlighter Mint (#e2ffcc) and overlaps photographic backgrounds. The extreme scale means one line of text occupies the full width — the headline IS the layout, not contained within it.

### Tilted Photo Card
**Role:** Scrapbook-style image cluster on dark sections

Photographs at roughly 280–360px wide, set at varying rotation angles (approximately -8°, +12°, +4°) to create a hand-scattered, Polaroid-tossed effect. No border, no shadow, no radius — raw 0px corners. Overlaps and partially covers neighboring images. Sits on Carbon Ink (#161b13) background.

### Circular Icon Badge
**Role:** Standalone illustrated icon pinned to sections

Small circular badge (approximately 40–48px diameter) with a 1.5px stroke outline in Highlighter Mint (#e2ffcc), transparent fill. Contains a simple line illustration (e.g. hat, house, location pin). Functions as a decorative marker — not interactive chrome.

### Footer Caption Block
**Role:** Small all-caps location/credit text in the lower-right

Mono 10–12px, line-height 1.20, letter-spacing -0.01em, color Highlighter Mint (#e2ffcc) on dark. All-caps. Two to three short lines of geographical/brand lineage copy. Right-aligned, sits near the bottom edge with generous margin (190px+ from one side).

### Section Band — Dark
**Role:** Full-bleed dark content band

Background Carbon Ink (#161b13), spans full viewport width, no max-width constraint. Contains scattered tilted photo cards, icon badges, and Highlighter Mint text. Section padding is roughly 67–70px top/bottom.

### Section Band — Light
**Role:** Full-bleed light content band

Background Topo Gray (#dde2e4) or photographic. Mono body text in Forest Charcoal (#2d3329). Section padding 67–70px. Often the top band under a full-bleed photographic hero.

### Inline Link
**Role:** Text links within body copy

Serif (Times) at 16px, underline present, color Forest Charcoal (#2d3329) on light backgrounds. The only serif moment in the system — reads as editorial anchor text.

### Scroll Cue Indicator
**Role:** Small fixed element near bottom of viewport

Tiny circular or hexagonal icon (approximately 24px) with 1px stroke in Forest Charcoal (#2d3329) or Highlighter Mint (#e2ffcc). Suggests downward scroll direction. No fill, no animation chrome — a quiet directional hint.

## Do's and Don'ts

### Do
- Use F37stout for display moments only — let 366px headlines own the viewport, never shrink below 40px
- Set all display text in Highlighter Mint (#e2ffcc) and let it overlap photographic backgrounds
- Keep line-height at 0.90 for all F37stout type — the extreme tightness is the signature
- Use mono (system mono substitute) at 10/12/16px for all UI, body, and caption text with -0.01em tracking
- Set section gaps at 67–70px and element gaps at 24px — the rhythm comes from the 6px base unit scaled up
- Scatter tilted photo cards at varying rotation angles (-12° to +12°) on Carbon Ink (#161b13) backgrounds
- Keep radius at 0px for all components — corners stay sharp, the design language is topo-map crisp

### Don't
- Don't add border-radius to buttons, cards, or images — sharp corners are non-negotiable
- Don't use a second chromatic accent — Highlighter Mint is the only color moment that carries brand
- Don't set F37stout at intermediate sizes (16–36px) — it only works at display scale or subheading scale (40–48px)
- Don't use Times for body copy — it's a link accent only, the rest of the system is mono
- Don't apply shadows or elevation — surfaces are defined purely by color and photographic layering
- Don't center body text — mono UI copy should sit left-aligned or right-aligned, never centered
- Don't introduce a third neutral — the five-tone scale (#dde2e4 → #84907f → #2d3329 → #161b13 → #000000) is the complete tonal range

## Elevation

No shadows, no drop shadows, no glow effects. Depth is created entirely through the layered overlap of photographic elements on solid color backgrounds, and through the surface scale from Topo Gray through Carbon Ink. The flatness is deliberate — it reads as printed paper, not digital UI.

## Surfaces

- **Topo Gray** (`#dde2e4`) — Light page canvas and card base
- **Highlighter Mint** (`#e2ffcc`) — Accent surface for highlighted text blocks and tonal emphasis
- **Sage Stone** (`#84907f`) — Mid-tone surface for subdued sections
- **Forest Charcoal** (`#2d3329`) — Deep UI surface on light themes
- **Carbon Ink** (`#161b13`) — Dark section background — alternate page band

## Imagery

Photography is the primary visual content — expansive landscape shots of canyons, mountains, and fly-fishing environments, treated as full-bleed hero backgrounds without color grading or filters. Tonal range is warm golden-hour to cool dusk. Secondary imagery appears as scattered, hand-tilted Polaroid-style snapshots (rotated -12° to +12°) on dark sections, creating a scrapbook/zine aesthetic. No illustrations, no product renders, no abstract graphics. The only non-photographic visual is simple line-drawn icon badges (hat, house, location markers) in 1.5px stroke. Photography occupies roughly 60% of total page real estate — image-heavy overall, with text punctuating rather than dominating.

## Layout

Full-bleed edge-to-edge layout with no max-width container — the canvas stretches to viewport edges on all sections. Hero pattern: full-viewport landscape photograph with the massive display headline overlapping the lower portion of the image. Section rhythm alternates between photographic/light bands and solid dark bands (#161b13), each spanning full width. Dark sections feature asymmetric, hand-scattered photo clusters rather than grids. Navigation is a minimal top bar — wordmark left, single outlined button right — with no sticky behavior apparent. Content arrangement is deliberately non-grid: photos are rotated and overlapping, text blocks sit at irregular margins (67px, 70px, 190px observed), creating a journal/zine composition rather than a SaaS dashboard. No card grids, no pricing tables, no feature matrices. Generous breathing room between sections (67–70px) but tight internal spacing (12–24px).

## Similar Brands

- **Topo Designs** — Same outdoor-brand full-bleed photography, condensed display type, and minimal chrome — both treat the website as a lookbook rather than a store
- **Patagonia** — Landscape-first hero imagery with environmental storytelling, though San Rita is more zine-scrapbook and less editorial
- **Rumpl** — Same utilitarian mono UI type, photographic full-bleed sections, and topographic/field-guide visual language
- **Poler** — Hand-tilted photo collage aesthetic, dark-and-photo alternating sections, casual outdoor brand attitude over polished e-commerce
- **Snow Peak** — Minimal nav chrome, landscape photography dominance, and typography that prioritizes display moments over body text density
````

</details>

#### CSS Variables — Extended (verbatim)

````css
:root {
  /* Colors */
  --color-highlighter-mint: #e2ffcc;
  --color-sage-stone: #84907f;
  --color-carbon-ink: #161b13;
  --color-forest-charcoal: #2d3329;
  --color-topo-gray: #dde2e4;
  --color-pure-black: #000000;

  /* Typography — Font Families */
  --font-f37stout: 'F37stout', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: 'mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --font-times: 'Times', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 10px;
  --leading-caption: 1.2;
  --tracking-caption: -0.01px;
  --text-body: 16px;
  --leading-body: 1.2;
  --tracking-body: -0.01px;
  --text-subheading: 40px;
  --leading-subheading: 0.9;
  --text-heading: 48px;
  --leading-heading: 0.9;
  --text-display: 366px;
  --leading-display: 0.9;

  /* Typography — Weights */
  --font-weight-regular: 400;
  --font-weight-bold: 700;

  /* Spacing */
  --spacing-unit: 6px;
  --spacing-5: 5px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-24: 24px;
  --spacing-40: 40px;
  --spacing-67: 67px;
  --spacing-70: 70px;
  --spacing-190: 190px;

  /* Layout */
  --section-gap: 67px;
  --card-padding: 16px;
  --element-gap: 24px;

  /* Named Radii */
  --radius-tags: 0px;
  --radius-cards: 0px;
  --radius-buttons: 0px;

  /* Surfaces */
  --surface-topo-gray: #dde2e4;
  --surface-highlighter-mint: #e2ffcc;
  --surface-sage-stone: #84907f;
  --surface-forest-charcoal: #2d3329;
  --surface-carbon-ink: #161b13;
}
````

#### CSS Variables — Compact (verbatim)

````css
:root {
  /* Colors */
  --color-highlighter-mint: #e2ffcc;
  --color-sage-stone: #84907f;
  --color-carbon-ink: #161b13;
  --color-forest-charcoal: #2d3329;
  --color-topo-gray: #dde2e4;
  --color-pure-black: #000000;

  /* Typography — Font Families */
  --font-f37stout: 'F37stout', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: 'mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --font-times: 'Times', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
````

#### Tailwind v4 — Extended (verbatim)

````css
@theme {
  /* Colors */
  --color-highlighter-mint: #e2ffcc;
  --color-sage-stone: #84907f;
  --color-carbon-ink: #161b13;
  --color-forest-charcoal: #2d3329;
  --color-topo-gray: #dde2e4;
  --color-pure-black: #000000;

  /* Typography */
  --font-f37stout: 'F37stout', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: 'mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --font-times: 'Times', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

  /* Typography — Scale */
  --text-caption: 10px;
  --leading-caption: 1.2;
  --tracking-caption: -0.01px;
  --text-body: 16px;
  --leading-body: 1.2;
  --tracking-body: -0.01px;
  --text-subheading: 40px;
  --leading-subheading: 0.9;
  --text-heading: 48px;
  --leading-heading: 0.9;
  --text-display: 366px;
  --leading-display: 0.9;

  /* Spacing */
  --spacing-5: 5px;
  --spacing-12: 12px;
  --spacing-16: 16px;
  --spacing-24: 24px;
  --spacing-40: 40px;
  --spacing-67: 67px;
  --spacing-70: 70px;
  --spacing-190: 190px;
}
````

#### Tailwind v4 — Compact (verbatim)

````css
@theme {
  /* Colors */
  --color-highlighter-mint: #e2ffcc;
  --color-sage-stone: #84907f;
  --color-carbon-ink: #161b13;
  --color-forest-charcoal: #2d3329;
  --color-topo-gray: #dde2e4;
  --color-pure-black: #000000;

  /* Typography */
  --font-f37stout: 'F37stout', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-mono: 'mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --font-times: 'Times', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
````

#### Design Tokens — Extended (verbatim)

````json
{
  "color": {
    "highlighter-mint": {
      "$value": "#e2ffcc",
      "$type": "color",
      "$description": "Highlighter Mint — Primary brand accent — display text, nav links, button labels, icon fills. The signature color; reads as highlighter pen on topo map"
    },
    "sage-stone": {
      "$value": "#84907f",
      "$type": "color",
      "$description": "Sage Stone — Muted secondary accent — subtle background washes, subdued UI elements where Highlighter Mint would be too loud"
    },
    "carbon-ink": {
      "$value": "#161b13",
      "$type": "color",
      "$description": "Carbon Ink — Dark section backgrounds — near-black with the faintest green undertone, anchors the dark bands of the page"
    },
    "forest-charcoal": {
      "$value": "#2d3329",
      "$type": "color",
      "$description": "Forest Charcoal — Mid-dark text and borders on light sections — softer than pure black, keeps the green-warmth consistent"
    },
    "topo-gray": {
      "$value": "#dde2e4",
      "$type": "color",
      "$description": "Topo Gray — Light section backgrounds, card surfaces, hairlines — the base canvas for light bands"
    },
    "pure-black": {
      "$value": "#000000",
      "$type": "color",
      "$description": "Pure Black — Icon strokes, link underlines, high-contrast accents where maximum punch is needed"
    }
  },
  "font": {
    "f37stout": {
      "$value": "F37stout",
      "$type": "fontFamily",
      "$description": "Display face for section openers and brand wordmark. The extreme condensed proportions at 0.90 line-height and a single weight (400) create landscape-blocking headlines that read as stamped signage, not web type. At 366px it fills the viewport; at 40–48px it becomes a tight sectional label."
    },
    "mono": {
      "$value": "mono",
      "$type": "fontFamily",
      "$description": "All UI chrome, body copy, nav, captions, buttons, footer text. The -0.01em tracking and tight 1.20 line-height give it a screen-printed, field-guide density. Weight 700 is used sparingly for emphasis; weight 400 carries the load. All-caps treatments dominate — this face behaves like a typewriter."
    },
    "times": {
      "$value": "Times",
      "$type": "fontFamily",
      "$description": "Serif accent for inline links, providing a newspaper/editorial contrast against the mono body. Used sparingly — one or two link moments per page."
    }
  },
  "typography": {
    "xs": {
      "$value": {
        "fontFamily": "mono",
        "fontSize": "10px",
        "fontWeight": 700,
        "lineHeight": 1.2,
        "letterSpacing": "0em"
      },
      "$type": "typography",
      "$description": "Typography step xs at 10px"
    },
    "xs-2": {
      "$value": {
        "fontFamily": "mono",
        "fontSize": "10px",
        "fontWeight": 400,
        "lineHeight": 1.2,
        "letterSpacing": "0em"
      },
      "$type": "typography",
      "$description": "Typography step xs-2 at 10px"
    },
    "xs-3": {
      "$value": {
        "fontFamily": "mono",
        "fontSize": "10px",
        "fontWeight": 400,
        "lineHeight": 1.2,
        "letterSpacing": "0em"
      },
      "$type": "typography",
      "$description": "Typography step xs-3 at 10px"
    },
    "xs-4": {
      "$value": {
        "fontFamily": "mono",
        "fontSize": "12px",
        "fontWeight": 400,
        "lineHeight": 1.2,
        "letterSpacing": "0em"
      },
      "$type": "typography",
      "$description": "Typography step xs-4 at 12px"
    },
    "base": {
      "$value": {
        "fontFamily": "Times",
        "fontSize": "16px",
        "fontWeight": 400,
        "lineHeight": 1.2,
        "letterSpacing": "0em"
      },
      "$type": "typography",
      "$description": "Typography step base at 16px"
    },
    "base-2": {
      "$value": {
        "fontFamily": "mono",
        "fontSize": "16px",
        "fontWeight": 400,
        "lineHeight": 1.2,
        "letterSpacing": "0em"
      },
      "$type": "typography",
      "$description": "Typography step base-2 at 16px"
    },
    "base-3": {
      "$value": {
        "fontFamily": "mono",
        "fontSize": "16px",
        "fontWeight": 400,
        "lineHeight": 1.2,
        "letterSpacing": "0em"
      },
      "$type": "typography",
      "$description": "Typography step base-3 at 16px"
    },
    "base-4": {
      "$value": {
        "fontFamily": "mono",
        "fontSize": "16px",
        "fontWeight": 400,
        "lineHeight": 1.2,
        "letterSpacing": "0em"
      },
      "$type": "typography",
      "$description": "Typography step base-4 at 16px"
    },
    "base-5": {
      "$value": {
        "fontFamily": "mono",
        "fontSize": "16px",
        "fontWeight": 400,
        "lineHeight": 1.2,
        "letterSpacing": "-0.01em"
      },
      "$type": "typography",
      "$description": "Typography step base-5 at 16px"
    },
    "base-6": {
      "$value": {
        "fontFamily": "mono",
        "fontSize": "16px",
        "fontWeight": 700,
        "lineHeight": 1.2,
        "letterSpacing": "-0.01em"
      },
      "$type": "typography",
      "$description": "Typography step base-6 at 16px"
    },
    "base-7": {
      "$value": {
        "fontFamily": "mono",
        "fontSize": "16px",
        "fontWeight": 400,
        "lineHeight": 1.2,
        "letterSpacing": "-0.01em"
      },
      "$type": "typography",
      "$description": "Typography step base-7 at 16px"
    },
    "4xl": {
      "$value": {
        "fontFamily": "F37stout",
        "fontSize": "40px",
        "fontWeight": 400,
        "lineHeight": 0.9,
        "letterSpacing": "0em"
      },
      "$type": "typography",
      "$description": "Typography step 4xl at 40px"
    },
    "5xl": {
      "$value": {
        "fontFamily": "F37stout",
        "fontSize": "48px",
        "fontWeight": 400,
        "lineHeight": 0.9,
        "letterSpacing": "0em"
      },
      "$type": "typography",
      "$description": "Typography step 5xl at 48px"
    },
    "5xl-2": {
      "$value": {
        "fontFamily": "F37stout",
        "fontSize": "366px",
        "fontWeight": 400,
        "lineHeight": 0.9,
        "letterSpacing": "0em"
      },
      "$type": "typography",
      "$description": "Typography step 5xl-2 at 366px"
    }
  },
  "spacing": {
    "5": {
      "$value": "5px",
      "$type": "dimension",
      "$description": "Spacing 5px"
    },
    "12": {
      "$value": "12px",
      "$type": "dimension",
      "$description": "Spacing 12px"
    },
    "16": {
      "$value": "16px",
      "$type": "dimension",
      "$description": "Spacing 16px"
    },
    "24": {
      "$value": "24px",
      "$type": "dimension",
      "$description": "Spacing 24px"
    },
    "40": {
      "$value": "40px",
      "$type": "dimension",
      "$description": "Spacing 40px"
    },
    "67": {
      "$value": "67px",
      "$type": "dimension",
      "$description": "Spacing 67px"
    },
    "70": {
      "$value": "70px",
      "$type": "dimension",
      "$description": "Spacing 70px"
    },
    "190": {
      "$value": "190px",
      "$type": "dimension",
      "$description": "Spacing 190px"
    },
    "unit": {
      "$value": "6px",
      "$type": "dimension",
      "$description": "Base spacing unit"
    }
  },
  "surface": {
    "topo-gray": {
      "$value": "#dde2e4",
      "$type": "color",
      "$description": "Surface level 0: Light page canvas and card base"
    },
    "highlighter-mint": {
      "$value": "#e2ffcc",
      "$type": "color",
      "$description": "Surface level 1: Accent surface for highlighted text blocks and tonal emphasis"
    },
    "sage-stone": {
      "$value": "#84907f",
      "$type": "color",
      "$description": "Surface level 2: Mid-tone surface for subdued sections"
    },
    "forest-charcoal": {
      "$value": "#2d3329",
      "$type": "color",
      "$description": "Surface level 3: Deep UI surface on light themes"
    },
    "carbon-ink": {
      "$value": "#161b13",
      "$type": "color",
      "$description": "Surface level 4: Dark section background — alternate page band"
    }
  },
  "$extensions": {
    "com.refero.extraction": {
      "url": "https://sanrita.ca/about",
      "siteName": "San Rita",
      "extractedAt": "2026-06-03T17:19:53.815Z",
      "variant": "extended"
    }
  }
}
````

#### Design Tokens — Compact (verbatim)

````json
{
  "color": {
    "highlighter-mint": {
      "$value": "#e2ffcc",
      "$type": "color",
      "$description": "Highlighter Mint — Primary brand accent — display text, nav links, button labels, icon fills. The signature color; reads as highlighter pen on topo map"
    },
    "sage-stone": {
      "$value": "#84907f",
      "$type": "color",
      "$description": "Sage Stone — Muted secondary accent — subtle background washes, subdued UI elements where Highlighter Mint would be too loud"
    },
    "carbon-ink": {
      "$value": "#161b13",
      "$type": "color",
      "$description": "Carbon Ink — Dark section backgrounds — near-black with the faintest green undertone, anchors the dark bands of the page"
    },
    "forest-charcoal": {
      "$value": "#2d3329",
      "$type": "color",
      "$description": "Forest Charcoal — Mid-dark text and borders on light sections — softer than pure black, keeps the green-warmth consistent"
    },
    "topo-gray": {
      "$value": "#dde2e4",
      "$type": "color",
      "$description": "Topo Gray — Light section backgrounds, card surfaces, hairlines — the base canvas for light bands"
    },
    "pure-black": {
      "$value": "#000000",
      "$type": "color",
      "$description": "Pure Black — Icon strokes, link underlines, high-contrast accents where maximum punch is needed"
    }
  },
  "font": {
    "f37stout": {
      "$value": "F37stout",
      "$type": "fontFamily",
      "$description": "Display face for section openers and brand wordmark. The extreme condensed proportions at 0.90 line-height and a single weight (400) create landscape-blocking headlines that read as stamped signage, not web type. At 366px it fills the viewport; at 40–48px it becomes a tight sectional label."
    },
    "mono": {
      "$value": "mono",
      "$type": "fontFamily",
      "$description": "All UI chrome, body copy, nav, captions, buttons, footer text. The -0.01em tracking and tight 1.20 line-height give it a screen-printed, field-guide density. Weight 700 is used sparingly for emphasis; weight 400 carries the load. All-caps treatments dominate — this face behaves like a typewriter."
    },
    "times": {
      "$value": "Times",
      "$type": "fontFamily",
      "$description": "Serif accent for inline links, providing a newspaper/editorial contrast against the mono body. Used sparingly — one or two link moments per page."
    }
  },
  "$extensions": {
    "com.refero.extraction": {
      "url": "https://sanrita.ca/about",
      "siteName": "San Rita",
      "extractedAt": "2026-06-03T17:19:53.815Z",
      "variant": "compact"
    }
  }
}
````

### Fields not on the page

- Max width: not on the page (no max-width row in Spacing; DESIGN.md Layout says 'no max-width container').
- Shadow/elevation values: not on the page (explicitly none).
- Motion/animation tokens: not on the page.
- Border radius rows in the on-page 'BORDER RADIUS' table render with no visible text (values are 0px per DESIGN.md).
- Letter spacing per type-scale step on the on-page scale: not on the page (only in the font cards and DESIGN.md type scale table).
- 'Preview' tab exists in a second tablist but renders the same export panel; no separate preview content was found.

### Source-site screenshots and observations

Desktop 1440x900: `work/design/source/refero-1-desktop.png`

1. Hierarchy: the live home page (https://sanrita.ca/en, 'Atelier San Rita - Creative Studio') is an interactive aerial terrain map occupying roughly 70% of the width on a Topo Gray canvas. The only large type is the F37stout headline 'A CREATIVE STUDIO WHERE BRANDS AND STORIES MOVE OFF-TRAILS' in Forest Charcoal at the bottom-left (measured 40px, weight 400), while Highlighter Mint appears only on top of photography ('SCROLL TO ENTER OUR WORLD', the 'SAN RITA' wordmark, dashed trail lines). Measured text nodes: F37stout 40px (28) and 32px (3), mono 10/12/16px at 400/700 plus 8px (2), Times New Roman 16px (16). The 32px F37stout breaks the page's own Don't about intermediate sizes.
2. Density: a left rail of nav items (MAP, PROJECTS, ABOUT, PLAYGROUND, CONTACT, INSTAGRAM, LINKEDIN) in 12px mono caps, each with a pictogram, followed by a map legend (Road, Trail, Fishing spot, Viewpoint) in 10px mono at about 35px row pitch. The frame edges carry hairline grid rules and letter-spaced mono metadata ('07:16:00 GMT', 'EST.2024', '72PX | 54PT', '16.1KM | 10MI', vertical 'DESIGN & DEVELOPMENT PURVEYORS'), so the chrome reads as cartographic, small and quiet.
3. Cards, buttons and motion: the 'VIEW MORE / LATEST HOT SPOT ADDED / PODIUM GLOBAL' card is a Carbon Ink panel with mint display text and a thin inner rule, with square corners and no shadow; the +/- zoom controls are flat dark squares. The first visit shows a full-screen loader of about 10s ('TERRAFORMING ACTIVATED', mono status lines on both sides, '_100%', a mint dashed trail drawn between dark nodes). Measured transitions are short: opacity 0.3s ease, all 0.15s/0.2s/0.3s/0.5s ease, transform 0.35s cubic-bezier(0, 0.55, 0.45, 1), which is an ease-out with no bounce.

Mobile 375x812: `work/design/source/refero-1-mobile.png`

1. Buttons: at 375px the header turns into a Highlighter Mint filled bar holding the 'SAN RITA' wordmark, a 'SHOW TRAILS' mono caps label and a compass icon, with a chamfered top-right corner and no radius. Mint works as a surface here, unlike the outlined nav button the Refero page describes.
2. Hierarchy: the map becomes a full-screen background. Section entry points are map nodes: 'ABOUT' is set in F37stout with a circular dark stamp badge (house pictogram, mint stroke), which matches the Circular Icon Badge component. The headline 'A CREATIVE STUDIO WHERE BRANDS AND STORIES MOVE OFF-TRAILS' drops to about 22px F37stout in mint over a darkened lower part of the photo, next to a compass glyph.
3. Density: almost no text on screen. The nav collapses into map nodes and trails, the gutter is about 12px, and the only small text is the letter-spaced mono '©2026 - ATELIER SAN RITA INC.' at the bottom. The loader ran about 25s at this size before the map appeared.

## Style 2 — INVERSA

### Identity

| Field | Value |
|---|---|
| Style name | INVERSA |
| Tagline | topographic field terminal at midnight. A dark command surface where massive editorial type and a single neon-lime marker layer over satellite earth photography, every label set in mono as if reading mission coordinates. |
| Theme | dark (from DESIGN.md `**Theme:**`) |
| Refero page URL | https://styles.refero.design/style/8a6dc9c8-7892-4eab-baaa-3c342d5671f2 |
| Source site (as listed on Refero) | https://inversa.com |

Description paragraph (verbatim):

> Inversa operates as a dark conservation-tech command console: a near-black canvas saturated with aerial earth imagery, where massive editorial type and a single electric lime accent function like tactical highlights on a topo map. The visual language is sparse and deliberate — generous negative space, no shadows, near-zero radius — letting one vivid chromatic note (electric lime) cut through the otherwise binary warm-cream-on-near-black system. Typography does the heavy lifting: a humanist sans at near-architectural sizes (58–72px) speaks the narrative voice, while JetBrains Mono handles every data label, tag, and interface annotation as if reading coordinates. Components are utilitarian and unadorned — sharp 3.6px corners, no elevation, no decorative chrome — creating the feel of a field instrument rather than a marketing site.

### Source site

Refero lists `https://inversa.com` as the extraction URL. The home page loads at `https://inversa.com/` (title: 'INVERSA - Home').

### Colors

Color Palette section as rendered on the page (verbatim innerText):

````text
Color Palette

BRAND

Copy
Lime Surveyor
#ebfc72
Green supporting accent for decorative details and low-frequency emphasis. Do not promote it to the primary CTA color

ACCENT

Copy
Marsh Olive
#bacd31
Gradient transition shade for the lime accent — deeper stop used in horizontal lime fades

NEUTRALS

Copy
Obsidian Loam
#13140e
Page canvas, hero background, card surfaces — the near-black base with a faint olive cast that keeps the dark from feeling synthetic
Copy
Iron Filings
#404040
Hairline borders, footer dividers, low-emphasis rules
Copy
Drift Ash
#84837b
Muted secondary text, placeholder input state, low-contrast labels on light surfaces
Copy
Bone Vellum
#f4f3e8
Primary text, body copy, headings, icon strokes, border color on dark — warm off-white that reads as paper, not LCD white
````

Token table from DESIGN.md (verbatim):

| Name | Value | Token | Role |
|------|-------|-------|------|
| Obsidian Loam | `#13140e` | `--color-obsidian-loam` | Page canvas, hero background, card surfaces — the near-black base with a faint olive cast that keeps the dark from feeling synthetic |
| Bone Vellum | `#f4f3e8` | `--color-bone-vellum` | Primary text, body copy, headings, icon strokes, border color on dark — warm off-white that reads as paper, not LCD white |
| Iron Filings | `#404040` | `--color-iron-filings` | Hairline borders, footer dividers, low-emphasis rules |
| Drift Ash | `#84837b` | `--color-drift-ash` | Muted secondary text, placeholder input state, low-contrast labels on light surfaces |
| Lime Surveyor | `#ebfc72` | `--color-lime-surveyor` | Green supporting accent for decorative details and low-frequency emphasis. Do not promote it to the primary CTA color |
| Marsh Olive | `#bacd31` | `--color-marsh-olive` | Gradient transition shade for the lime accent — deeper stop used in horizontal lime fades |

Surfaces (verbatim from DESIGN.md):

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 1 | Obsidian Loam | `#13140` | Page canvas, hero background, full-bleed image overlay base |
| 2 | Iron Filings | `#404040` | Hairline borders, footer rule lines, low-emphasis dividers |

### Typography

Typography section as rendered on the page, type scale expanded via 'Show all' (verbatim innerText):

````text
Typography

TYPE SCALE

Minor Third (1.2) from 16px base

display
72px · 400 · 0.9
The quick brown fox jumps
65px
65px · 400 · 1.2
The quick brown fox jumps
heading
58px · 400 · 1.06
The quick brown fox jumps
29px
29px · 700 · 1.2
The quick brown fox jumps
18px
18px · 400 · 1.25
The quick brown fox jumps
18px
18px · 300 · 1.25
THE QUICK BROWN FOX JUMPS
14px
14px · 400 · 1.2
The quick brown fox jumps
14px
14px · 400 · 1.2
The quick brown fox jumps
14px
14px · 400 · 1.62
The quick brown fox jumps
13px
13px · 300 · 1.28
THE QUICK BROWN FOX JUMPS
13px
13px · 400 · 1.25
The quick brown fox jumps
Show less

FONTS

PRIMARY
NB International Pro
Weight
400
Sizes
13–72px · 5 values
Line height
0.9–1.62 · 5 values
Letter spacing
-0.0300em
Fallback
Söhne, Inter, or system-ui

Display and body — the brand's primary voice. Set at 72px for hero statements and 58px for section headers with -0.03em tracking, producing a compressed, editorial presence. Also carries body text at 18px (lh 1.62) and UI labels at 13–14px. Its humanist warmth prevents the dark canvas from feeling cold or corporate.

CODE
JetBrains Mono
Weight
300, 400, 700
Sizes
13–65px · 5 values
Line height
1.20, 1.25, 1.28
Letter spacing
normal
Fallback
JetBrains Mono, IBM Plex Mono, or Space Mono

Interface annotations, data labels, button text, tag values, and secondary display moments. The monospaced geometry reads as coordinates, timestamps, and telemetry — reinforcing the field-instrument metaphor. Set in weight 300 for hero-scale data callouts (65px) to keep mono from feeling mechanical at large sizes.
````

Typography tokens from DESIGN.md (verbatim):

#### NB International Pro — Display and body — the brand's primary voice. Set at 72px for hero statements and 58px for section headers with -0.03em tracking, producing a compressed, editorial presence. Also carries body text at 18px (lh 1.62) and UI labels at 13–14px. Its humanist warmth prevents the dark canvas from feeling cold or corporate. · `--font-nb-international-pro`
- **Substitute:** Söhne, Inter, or system-ui
- **Weights:** 400
- **Sizes:** 13px, 14px, 18px, 58px, 72px
- **Line height:** 0.90, 1.06, 1.20, 1.25, 1.62
- **Letter spacing:** -0.0300em
- **Role:** Display and body — the brand's primary voice. Set at 72px for hero statements and 58px for section headers with -0.03em tracking, producing a compressed, editorial presence. Also carries body text at 18px (lh 1.62) and UI labels at 13–14px. Its humanist warmth prevents the dark canvas from feeling cold or corporate.

#### JetBrains Mono — Interface annotations, data labels, button text, tag values, and secondary display moments. The monospaced geometry reads as coordinates, timestamps, and telemetry — reinforcing the field-instrument metaphor. Set in weight 300 for hero-scale data callouts (65px) to keep mono from feeling mechanical at large sizes. · `--font-jetbrains-mono`
- **Substitute:** JetBrains Mono, IBM Plex Mono, or Space Mono
- **Weights:** 300, 400, 700
- **Sizes:** 13px, 14px, 18px, 29px, 65px
- **Line height:** 1.20, 1.25, 1.28
- **Letter spacing:** normal
- **Role:** Interface annotations, data labels, button text, tag values, and secondary display moments. The monospaced geometry reads as coordinates, timestamps, and telemetry — reinforcing the field-instrument metaphor. Set in weight 300 for hero-scale data callouts (65px) to keep mono from feeling mechanical at large sizes.

#### Type Scale

| Role | Family | Weight | Size | Line Height | Letter Spacing | Token |
|------|--------|--------|------|-------------|----------------|-------|
| caption | — | — | 13px | 1.2 | 0px | `--text-caption` |
| body | — | — | 18px | 1.62 | -0.54px | `--text-body` |
| subheading | — | — | 29px | 1.28 | 0px | `--text-subheading` |
| heading | — | — | 58px | 1.06 | -1.74px | `--text-heading` |
| display | — | — | 72px | 0.9 | -2.16px | `--text-display` |

### Spacing and layout

Spacing & Shape section as rendered on the page (verbatim innerText; preview column is visual only):

````text
Spacing & Shape

SPACING

Purpose	Value	Preview
Density	comfortable
	
Max width	1200px
	

Section gap	86-104px
	

Card padding	14-18px
	

Element gap	18px
	

BORDER RADIUS

Element	Value	Preview
Tags	3.6px
	

Inputs	3.6px
	

Buttons	3.6px
````

Spacing and shape tokens from DESIGN.md (verbatim):

**Density:** comfortable

#### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 5 | 5px | `--spacing-5` |
| 7 | 7px | `--spacing-7` |
| 14 | 14px | `--spacing-14` |
| 18 | 18px | `--spacing-18` |
| 21 | 21px | `--spacing-21` |
| 29 | 29px | `--spacing-29` |
| 59 | 59px | `--spacing-59` |
| 86 | 86px | `--spacing-86` |
| 104 | 104px | `--spacing-104` |
| 119 | 119px | `--spacing-119` |

#### Border Radius

| Element | Value |
|---------|-------|
| tags | 3.6px |
| cards | 0px |
| inputs | 3.6px |
| buttons | 3.6px |

#### Layout

- **Page max-width:** 1200px
- **Section gap:** 86-104px
- **Card padding:** 14-18px
- **Element gap:** 18px

Layout (verbatim from DESIGN.md):

> Full-bleed dark canvas with content anchored to a max-width 1200px column. The hero is a full-viewport satellite image with bottom-left text overlay — a massive 72px headline, a lime-filled action button directly below, and minimal nav (brand wordmark top-left, menu top-right). Sections are separated by generous 86–104px vertical gaps rather than dividers, creating a sense of topographic sheets laid on a dark surface. Content alternates between full-bleed image bands and contained text blocks. The grid is narrow (2–3 columns max) — this is not a dense dashboard but a reading surface for mission briefings.

### Shape and depth

Radii per element (from DESIGN.md Border Radius table):

- tags: 3.6px
- cards: 0px
- inputs: 3.6px
- buttons: 3.6px

Elevation (verbatim from DESIGN.md):

> The system is deliberately shadowless. All depth is communicated through color contrast (lime on black) and typographic scale rather than box-shadow elevation. The near-zero border radius and absence of shadows give every element a flat, instrument-panel quality — surfaces feel like etched markings, not stacked cards.

Shadow values: none on the page (style is explicitly shadowless; no shadow tokens in any export).

Imagery (verbatim from DESIGN.md):

> Full-bleed aerial and satellite photography of coastline, estuaries, and terrain — the imagery IS the atmosphere, not decoration. Photos span edge-to-edge with no framing, border, or radius. Color treatment is naturalistic (greens, earth tones, water blues) allowed to carry the only chromatic weight in the system, while overlaid UI remains monochrome. No product screenshots, no illustrations, no abstract graphics — the site is a map and a logbook, not a brochure.

### Components

Named components: Hero Headline, Lime Action Button, Ghost Text Button, Data Tag, Top Navigation Bar, Full-Bleed Image Band, Text Block (Dark Surface), Footer, Input Field.

Components section (verbatim from DESIGN.md):

#### Hero Headline
**Role:** Primary page-level statement, 58–72px

NB International Pro weight 400, 72px, line-height 0.90, letter-spacing -2.16px, color #f4f3e8. Sits bottom-left over full-bleed image with no background treatment. The extreme line-height (0.90) stacks lines tightly into a single block, creating weight without weight-of-stroke.

#### Lime Action Button
**Role:** Primary call-to-action, high-emphasis interactive

Background #ebfc72, text #13140, font JetBrains Mono weight 400 at 14px, padding 14px 18px, border-radius 3.6px, uppercase letter spacing. The button is the only high-saturation element on the page — its presence makes it impossible to miss without needing size or shadow emphasis.

#### Ghost Text Button
**Role:** Secondary action, low-emphasis interactive

Transparent background, text #f4f3e8, border optional 1px #404040, JetBrains Mono 14px, 3.6px radius. Used for navigation items and secondary links in dark contexts.

#### Data Tag
**Role:** Coordinate, label, or classification marker

Background #ebfc72 or transparent with #ebfc72 border, text #13140 or #f4f3e8, JetBrains Mono 13px weight 400, padding 5px 7px, 3.6px radius. Functions as the 'survey marker' of the system — small, bright, unmistakable.

#### Top Navigation Bar
**Role:** Site-wide header

Transparent over hero, fixed/sticky. Left: brand wordmark 'INVERSA' in NB International Pro 14px #f4f3e8. Right: 'Menu' trigger in JetBrains Mono 13px #f4f3e8 with small indicator dot. No background fill, no border — the nav floats on the image.

#### Full-Bleed Image Band
**Role:** Atmospheric section separator or context image

Edge-to-edge photographic imagery (aerial/satellite) with no radius, no border, no overlay. Sits at 100vw. Provides the only color in the system outside the lime accent.

#### Text Block (Dark Surface)
**Role:** Contained editorial content on canvas

No card chrome — content sits directly on #13140e. Headings in NB International Pro 58px #f4f3e8, body in 18px #f4f3e8 lh 1.62. No background fill, no border, no shadow. Spacing between blocks: 18px element gap, 86–104px section gap.

#### Footer
**Role:** Site footer

Full-width dark #13140 band. Top border 1px #404040. Content in JetBrains Mono 13px #f4f3e8. Sparse — typically 2–3 columns of links and metadata.

#### Input Field
**Role:** Text input

Transparent background on dark canvas, bottom border only 1px #404040, text in NB International Pro 14px #f4f3e8, placeholder #84837b. No fill, no radius on the field — the underline IS the field.

Agent Prompt Guide (verbatim from DESIGN.md):

````markdown
**Quick Color Reference**
- background: #13140e
- text: #f4f3e8
- border: #404040
- accent: #ebfc72
- muted text: #84837b
- primary action: no distinct CTA color

**Example Component Prompts**

1. Build a hero section: full-bleed background (any photo or solid #13140e), max-width 1200px content container, headline NB International Pro 72px weight 400 color #f4f3e8 line-height 0.90 letter-spacing -2.16px left-aligned at bottom-left. Include a lime-filled action button (#ebfc72 bg, #13140e text, JetBrains Mono 14px, 3.6px radius, 14px 18px padding).

2. Create a data tag: #ebfc72 background, #13140e text, JetBrains Mono 13px weight 400, padding 5px 7px, 3.6px radius, uppercase content.

3. Build a content section on dark canvas: #13140e background, no card chrome, heading in NB International Pro 58px #f4f3e8, body in NB International Pro 18px #f4f3e8 line-height 1.62, section gap 86–104px above and below.

4. Create a top navigation bar: transparent background, brand 'INVERSA' left in NB International Pro 14px #f4f3e8, 'Menu' label right in JetBrains Mono 13px #f4f3e8 with a 4px #f4f3e8 dot indicator beside it.

5. Build a footer: full-width #13140e band with 1px #404040 top border, 2–3 column link grid in JetBrains Mono 13px #f4f3e8, 86px top padding.
````

### Guidelines

DO (verbatim):

- Set hero headlines at 58–72px NB International Pro weight 400 with line-height 0.90 and letter-spacing -0.03em — the tight leading stacks lines into a single mass.
- Use #ebfc72 as the sole chromatic accent for any element that needs to be noticed: buttons, active states, data tags, and icon highlights.
- Apply -0.03em letter-spacing to all NB International Pro text regardless of size — the tracking is part of the brand voice, not a display-only treatment.
- Let imagery bleed to all four edges at 100vw with zero radius, zero border, and zero overlay — the photo is the surface.
- Set all UI labels, button text, and metadata in JetBrains Mono — the mono voice distinguishes interface from editorial copy.
- Use 3.6px border-radius consistently for buttons, tags, and inputs — do not introduce larger radii for 'softness'.
- Space sections at 86–104px and separate them with whitespace, not dividers or background color shifts.

DON'T (verbatim):

- Do not add box-shadows to any element — the system is deliberately flat; depth comes from color contrast, not elevation.
- Do not introduce a second accent color — the lime is alone by design. Any other chromatic addition dilutes the survey-marker effect.
- Do not set body text below 18px in NB International Pro — the font's humanist proportions require generous size to read correctly.
- Do not use #000000 as the canvas — the olive undertone of #13140 is what makes the dark feel organic rather than digital.
- Do not round corners beyond 3.6px on any component — larger radii would contradict the instrument-panel aesthetic.
- Do not use colored backgrounds for cards or content blocks — content sits directly on the dark canvas with no chrome.
- Do not center body text — editorial alignment is left-aligned throughout, matching the mission-log reading flow.

### Similar brands

Similar Brands (verbatim from DESIGN.md):

- **Planet Labs** — Same full-bleed satellite earth photography as the visual backbone, dark canvas, and single-color data annotation approach
- **Sentinel Hub** — Identical top-map-as-hero pattern with minimal text overlay and utilitarian interface chrome
- **Radiant Earth** — Dark-mode conservation/earth-observation aesthetic with editorial-scale type and restrained accent usage
- **Stripe Press** — Same editorial use of NB International-style humanist sans at large compressed sizes on dark backgrounds, treated like a publication rather than a product
- **Vercel** — Near-identical typographic attitude — dark canvas, mono for UI labels, humanist sans for headlines, zero-radius buttons, and shadowless flat surfaces

'More like this' cards on the page (name — truncated card tagline, as shown):

- Inngest — Warm-black observatory — quiet,…
- Ameba — Midnight control room — electric…
- Henry — darkroom gallery at midnight —…
- Adnaut — After-hours mission control lit by…
- Prevalent — Editorial command observatory —…
- dope.security — Midnight terminal with violet…
- Ventriloc — Editorial data observatory on warm…
- Grafbase — engineering blueprint on cool…
- Axiom — Terminal window at midnight — flat…
- Eco — skyline vault at dusk — a…
- Twingate — Midnight control room with violet…
- Warp — obsidian command center — a…
- Default — Mission control behind frosted…
- Basedash — Midnight data terminal with…
- Depot — Dark server-rack terminal. A…
- Exante — neon greenhouse at midnight
- Adaline — botanist's specimen journal beside…
- Doppler — violet-lit vault at midnight. A…
- Integrated Biosciences — bioluminescent laboratory at…
- Ori — Server-room at midnight — black…

### Exports

Each export tab has Compact and Extended modes; both are recorded verbatim.

#### DESIGN.md — Extended (verbatim)

````markdown
# INVERSA — Style Reference
> topographic field terminal at midnight. A dark command surface where massive editorial type and a single neon-lime marker layer over satellite earth photography, every label set in mono as if reading mission coordinates.

**Theme:** dark

Source measurements are normalized; roles and recommendations are interpreted. Font summary lists are independent, not paired by position. HTML examples are reconstructions, not source components.

Inversa operates as a dark conservation-tech command console: a near-black canvas saturated with aerial earth imagery, where massive editorial type and a single electric lime accent function like tactical highlights on a topo map. The visual language is sparse and deliberate — generous negative space, no shadows, near-zero radius — letting one vivid chromatic note (electric lime) cut through the otherwise binary warm-cream-on-near-black system. Typography does the heavy lifting: a humanist sans at near-architectural sizes (58–72px) speaks the narrative voice, while JetBrains Mono handles every data label, tag, and interface annotation as if reading coordinates. Components are utilitarian and unadorned — sharp 3.6px corners, no elevation, no decorative chrome — creating the feel of a field instrument rather than a marketing site.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Obsidian Loam | `#13140e` | `--color-obsidian-loam` | Page canvas, hero background, card surfaces — the near-black base with a faint olive cast that keeps the dark from feeling synthetic |
| Bone Vellum | `#f4f3e8` | `--color-bone-vellum` | Primary text, body copy, headings, icon strokes, border color on dark — warm off-white that reads as paper, not LCD white |
| Iron Filings | `#404040` | `--color-iron-filings` | Hairline borders, footer dividers, low-emphasis rules |
| Drift Ash | `#84837b` | `--color-drift-ash` | Muted secondary text, placeholder input state, low-contrast labels on light surfaces |
| Lime Surveyor | `#ebfc72` | `--color-lime-surveyor` | Green supporting accent for decorative details and low-frequency emphasis. Do not promote it to the primary CTA color |
| Marsh Olive | `#bacd31` | `--color-marsh-olive` | Gradient transition shade for the lime accent — deeper stop used in horizontal lime fades |

## Tokens — Typography

### NB International Pro — Display and body — the brand's primary voice. Set at 72px for hero statements and 58px for section headers with -0.03em tracking, producing a compressed, editorial presence. Also carries body text at 18px (lh 1.62) and UI labels at 13–14px. Its humanist warmth prevents the dark canvas from feeling cold or corporate. · `--font-nb-international-pro`
- **Substitute:** Söhne, Inter, or system-ui
- **Weights:** 400
- **Sizes:** 13px, 14px, 18px, 58px, 72px
- **Line height:** 0.90, 1.06, 1.20, 1.25, 1.62
- **Letter spacing:** -0.0300em
- **Role:** Display and body — the brand's primary voice. Set at 72px for hero statements and 58px for section headers with -0.03em tracking, producing a compressed, editorial presence. Also carries body text at 18px (lh 1.62) and UI labels at 13–14px. Its humanist warmth prevents the dark canvas from feeling cold or corporate.

### JetBrains Mono — Interface annotations, data labels, button text, tag values, and secondary display moments. The monospaced geometry reads as coordinates, timestamps, and telemetry — reinforcing the field-instrument metaphor. Set in weight 300 for hero-scale data callouts (65px) to keep mono from feeling mechanical at large sizes. · `--font-jetbrains-mono`
- **Substitute:** JetBrains Mono, IBM Plex Mono, or Space Mono
- **Weights:** 300, 400, 700
- **Sizes:** 13px, 14px, 18px, 29px, 65px
- **Line height:** 1.20, 1.25, 1.28
- **Letter spacing:** normal
- **Role:** Interface annotations, data labels, button text, tag values, and secondary display moments. The monospaced geometry reads as coordinates, timestamps, and telemetry — reinforcing the field-instrument metaphor. Set in weight 300 for hero-scale data callouts (65px) to keep mono from feeling mechanical at large sizes.

### Type Scale

| Role | Family | Weight | Size | Line Height | Letter Spacing | Token |
|------|--------|--------|------|-------------|----------------|-------|
| caption | — | — | 13px | 1.2 | 0px | `--text-caption` |
| body | — | — | 18px | 1.62 | -0.54px | `--text-body` |
| subheading | — | — | 29px | 1.28 | 0px | `--text-subheading` |
| heading | — | — | 58px | 1.06 | -1.74px | `--text-heading` |
| display | — | — | 72px | 0.9 | -2.16px | `--text-display` |

## Tokens — Spacing & Shapes

**Density:** comfortable

### Spacing Scale

| Name | Value | Token |
|------|-------|-------|
| 5 | 5px | `--spacing-5` |
| 7 | 7px | `--spacing-7` |
| 14 | 14px | `--spacing-14` |
| 18 | 18px | `--spacing-18` |
| 21 | 21px | `--spacing-21` |
| 29 | 29px | `--spacing-29` |
| 59 | 59px | `--spacing-59` |
| 86 | 86px | `--spacing-86` |
| 104 | 104px | `--spacing-104` |
| 119 | 119px | `--spacing-119` |

### Border Radius

| Element | Value |
|---------|-------|
| tags | 3.6px |
| cards | 0px |
| inputs | 3.6px |
| buttons | 3.6px |

### Layout

- **Page max-width:** 1200px
- **Section gap:** 86-104px
- **Card padding:** 14-18px
- **Element gap:** 18px

## Components

### Hero Headline
**Role:** Primary page-level statement, 58–72px

NB International Pro weight 400, 72px, line-height 0.90, letter-spacing -2.16px, color #f4f3e8. Sits bottom-left over full-bleed image with no background treatment. The extreme line-height (0.90) stacks lines tightly into a single block, creating weight without weight-of-stroke.

### Lime Action Button
**Role:** Primary call-to-action, high-emphasis interactive

Background #ebfc72, text #13140, font JetBrains Mono weight 400 at 14px, padding 14px 18px, border-radius 3.6px, uppercase letter spacing. The button is the only high-saturation element on the page — its presence makes it impossible to miss without needing size or shadow emphasis.

### Ghost Text Button
**Role:** Secondary action, low-emphasis interactive

Transparent background, text #f4f3e8, border optional 1px #404040, JetBrains Mono 14px, 3.6px radius. Used for navigation items and secondary links in dark contexts.

### Data Tag
**Role:** Coordinate, label, or classification marker

Background #ebfc72 or transparent with #ebfc72 border, text #13140 or #f4f3e8, JetBrains Mono 13px weight 400, padding 5px 7px, 3.6px radius. Functions as the 'survey marker' of the system — small, bright, unmistakable.

### Top Navigation Bar
**Role:** Site-wide header

Transparent over hero, fixed/sticky. Left: brand wordmark 'INVERSA' in NB International Pro 14px #f4f3e8. Right: 'Menu' trigger in JetBrains Mono 13px #f4f3e8 with small indicator dot. No background fill, no border — the nav floats on the image.

### Full-Bleed Image Band
**Role:** Atmospheric section separator or context image

Edge-to-edge photographic imagery (aerial/satellite) with no radius, no border, no overlay. Sits at 100vw. Provides the only color in the system outside the lime accent.

### Text Block (Dark Surface)
**Role:** Contained editorial content on canvas

No card chrome — content sits directly on #13140e. Headings in NB International Pro 58px #f4f3e8, body in 18px #f4f3e8 lh 1.62. No background fill, no border, no shadow. Spacing between blocks: 18px element gap, 86–104px section gap.

### Footer
**Role:** Site footer

Full-width dark #13140 band. Top border 1px #404040. Content in JetBrains Mono 13px #f4f3e8. Sparse — typically 2–3 columns of links and metadata.

### Input Field
**Role:** Text input

Transparent background on dark canvas, bottom border only 1px #404040, text in NB International Pro 14px #f4f3e8, placeholder #84837b. No fill, no radius on the field — the underline IS the field.

## Do's and Don'ts

### Do
- Set hero headlines at 58–72px NB International Pro weight 400 with line-height 0.90 and letter-spacing -0.03em — the tight leading stacks lines into a single mass.
- Use #ebfc72 as the sole chromatic accent for any element that needs to be noticed: buttons, active states, data tags, and icon highlights.
- Apply -0.03em letter-spacing to all NB International Pro text regardless of size — the tracking is part of the brand voice, not a display-only treatment.
- Let imagery bleed to all four edges at 100vw with zero radius, zero border, and zero overlay — the photo is the surface.
- Set all UI labels, button text, and metadata in JetBrains Mono — the mono voice distinguishes interface from editorial copy.
- Use 3.6px border-radius consistently for buttons, tags, and inputs — do not introduce larger radii for 'softness'.
- Space sections at 86–104px and separate them with whitespace, not dividers or background color shifts.

### Don't
- Do not add box-shadows to any element — the system is deliberately flat; depth comes from color contrast, not elevation.
- Do not introduce a second accent color — the lime is alone by design. Any other chromatic addition dilutes the survey-marker effect.
- Do not set body text below 18px in NB International Pro — the font's humanist proportions require generous size to read correctly.
- Do not use #000000 as the canvas — the olive undertone of #13140 is what makes the dark feel organic rather than digital.
- Do not round corners beyond 3.6px on any component — larger radii would contradict the instrument-panel aesthetic.
- Do not use colored backgrounds for cards or content blocks — content sits directly on the dark canvas with no chrome.
- Do not center body text — editorial alignment is left-aligned throughout, matching the mission-log reading flow.

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 1 | Obsidian Loam | `#13140` | Page canvas, hero background, full-bleed image overlay base |
| 2 | Iron Filings | `#404040` | Hairline borders, footer rule lines, low-emphasis dividers |

## Elevation

The system is deliberately shadowless. All depth is communicated through color contrast (lime on black) and typographic scale rather than box-shadow elevation. The near-zero border radius and absence of shadows give every element a flat, instrument-panel quality — surfaces feel like etched markings, not stacked cards.

## Imagery

Full-bleed aerial and satellite photography of coastline, estuaries, and terrain — the imagery IS the atmosphere, not decoration. Photos span edge-to-edge with no framing, border, or radius. Color treatment is naturalistic (greens, earth tones, water blues) allowed to carry the only chromatic weight in the system, while overlaid UI remains monochrome. No product screenshots, no illustrations, no abstract graphics — the site is a map and a logbook, not a brochure.

## Layout

Full-bleed dark canvas with content anchored to a max-width 1200px column. The hero is a full-viewport satellite image with bottom-left text overlay — a massive 72px headline, a lime-filled action button directly below, and minimal nav (brand wordmark top-left, menu top-right). Sections are separated by generous 86–104px vertical gaps rather than dividers, creating a sense of topographic sheets laid on a dark surface. Content alternates between full-bleed image bands and contained text blocks. The grid is narrow (2–3 columns max) — this is not a dense dashboard but a reading surface for mission briefings.

## Agent Prompt Guide

**Quick Color Reference**
- background: #13140e
- text: #f4f3e8
- border: #404040
- accent: #ebfc72
- muted text: #84837b
- primary action: no distinct CTA color

**Example Component Prompts**

1. Build a hero section: full-bleed background (any photo or solid #13140e), max-width 1200px content container, headline NB International Pro 72px weight 400 color #f4f3e8 line-height 0.90 letter-spacing -2.16px left-aligned at bottom-left. Include a lime-filled action button (#ebfc72 bg, #13140e text, JetBrains Mono 14px, 3.6px radius, 14px 18px padding).

2. Create a data tag: #ebfc72 background, #13140e text, JetBrains Mono 13px weight 400, padding 5px 7px, 3.6px radius, uppercase content.

3. Build a content section on dark canvas: #13140e background, no card chrome, heading in NB International Pro 58px #f4f3e8, body in NB International Pro 18px #f4f3e8 line-height 1.62, section gap 86–104px above and below.

4. Create a top navigation bar: transparent background, brand 'INVERSA' left in NB International Pro 14px #f4f3e8, 'Menu' label right in JetBrains Mono 13px #f4f3e8 with a 4px #f4f3e8 dot indicator beside it.

5. Build a footer: full-width #13140e band with 1px #404040 top border, 2–3 column link grid in JetBrains Mono 13px #f4f3e8, 86px top padding.

## Similar Brands

- **Planet Labs** — Same full-bleed satellite earth photography as the visual backbone, dark canvas, and single-color data annotation approach
- **Sentinel Hub** — Identical top-map-as-hero pattern with minimal text overlay and utilitarian interface chrome
- **Radiant Earth** — Dark-mode conservation/earth-observation aesthetic with editorial-scale type and restrained accent usage
- **Stripe Press** — Same editorial use of NB International-style humanist sans at large compressed sizes on dark backgrounds, treated like a publication rather than a product
- **Vercel** — Near-identical typographic attitude — dark canvas, mono for UI labels, humanist sans for headlines, zero-radius buttons, and shadowless flat surfaces

## Quick Start

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-obsidian-loam: #13140e;
  --color-bone-vellum: #f4f3e8;
  --color-iron-filings: #404040;
  --color-drift-ash: #84837b;
  --color-lime-surveyor: #ebfc72;
  --color-marsh-olive: #bacd31;

  /* Typography — Font Families */
  --font-nb-international-pro: 'NB International Pro', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-jetbrains-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  /* Typography — Scale */
  --text-caption: 13px;
  --leading-caption: 1.2;
  --tracking-caption: 0px;
  --text-body: 18px;
  --leading-body: 1.62;
  --tracking-body: -0.54px;
  --text-subheading: 29px;
  --leading-subheading: 1.28;
  --tracking-subheading: 0px;
  --text-heading: 58px;
  --leading-heading: 1.06;
  --tracking-heading: -1.74px;
  --text-display: 72px;
  --leading-display: 0.9;
  --tracking-display: -2.16px;

  /* Typography — Weights */
  --font-weight-light: 300;
  --font-weight-regular: 400;
  --font-weight-bold: 700;

  /* Spacing */
  --spacing-5: 5px;
  --spacing-7: 7px;
  --spacing-14: 14px;
  --spacing-18: 18px;
  --spacing-21: 21px;
  --spacing-29: 29px;
  --spacing-59: 59px;
  --spacing-86: 86px;
  --spacing-104: 104px;
  --spacing-119: 119px;

  /* Layout */
  --page-max-width: 1200px;
  --section-gap: 86-104px;
  --card-padding: 14-18px;
  --element-gap: 18px;

  /* Border Radius */
  --radius-md: 3.6px;

  /* Named Radii */
  --radius-tags: 3.6px;
  --radius-cards: 0px;
  --radius-inputs: 3.6px;
  --radius-buttons: 3.6px;

  /* Surfaces */
  --surface-obsidian-loam: #13140;
  --surface-iron-filings: #404040;
}
```

### Tailwind v4

```css
@theme {
  /* Colors */
  --color-obsidian-loam: #13140e;
  --color-bone-vellum: #f4f3e8;
  --color-iron-filings: #404040;
  --color-drift-ash: #84837b;
  --color-lime-surveyor: #ebfc72;
  --color-marsh-olive: #bacd31;

  /* Typography */
  --font-nb-international-pro: 'NB International Pro', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-jetbrains-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  /* Typography — Scale */
  --text-caption: 13px;
  --leading-caption: 1.2;
  --tracking-caption: 0px;
  --text-body: 18px;
  --leading-body: 1.62;
  --tracking-body: -0.54px;
  --text-subheading: 29px;
  --leading-subheading: 1.28;
  --tracking-subheading: 0px;
  --text-heading: 58px;
  --leading-heading: 1.06;
  --tracking-heading: -1.74px;
  --text-display: 72px;
  --leading-display: 0.9;
  --tracking-display: -2.16px;

  /* Spacing */
  --spacing-5: 5px;
  --spacing-7: 7px;
  --spacing-14: 14px;
  --spacing-18: 18px;
  --spacing-21: 21px;
  --spacing-29: 29px;
  --spacing-59: 59px;
  --spacing-86: 86px;
  --spacing-104: 104px;
  --spacing-119: 119px;

  /* Border Radius */
  --radius-md: 3.6px;
}
```
````

#### DESIGN.md — Compact (verbatim)

<details><summary>Show compact DESIGN.md</summary>

````markdown
# INVERSA — Style Reference
> topographic field terminal at midnight. A dark command surface where massive editorial type and a single neon-lime marker layer over satellite earth photography, every label set in mono as if reading mission coordinates.

**Theme:** dark

Source measurements are normalized; roles and recommendations are interpreted. Font summary lists are independent, not paired by position. HTML examples are reconstructions, not source components.

Inversa operates as a dark conservation-tech command console: a near-black canvas saturated with aerial earth imagery, where massive editorial type and a single electric lime accent function like tactical highlights on a topo map. The visual language is sparse and deliberate — generous negative space, no shadows, near-zero radius — letting one vivid chromatic note (electric lime) cut through the otherwise binary warm-cream-on-near-black system. Typography does the heavy lifting: a humanist sans at near-architectural sizes (58–72px) speaks the narrative voice, while JetBrains Mono handles every data label, tag, and interface annotation as if reading coordinates. Components are utilitarian and unadorned — sharp 3.6px corners, no elevation, no decorative chrome — creating the feel of a field instrument rather than a marketing site.

## Colors

| Name | Value | Role |
|------|-------|------|
| Obsidian Loam | `#13140e` | Page canvas, hero background, card surfaces — the near-black base with a faint olive cast that keeps the dark from feeling synthetic |
| Bone Vellum | `#f4f3e8` | Primary text, body copy, headings, icon strokes, border color on dark — warm off-white that reads as paper, not LCD white |
| Iron Filings | `#404040` | Hairline borders, footer dividers, low-emphasis rules |
| Drift Ash | `#84837b` | Muted secondary text, placeholder input state, low-contrast labels on light surfaces |
| Lime Surveyor | `#ebfc72` | Green supporting accent for decorative details and low-frequency emphasis. Do not promote it to the primary CTA color |
| Marsh Olive | `#bacd31` | Gradient transition shade for the lime accent — deeper stop used in horizontal lime fades |

## Typography

### NB International Pro — Display and body — the brand's primary voice. Set at 72px for hero statements and 58px for section headers with -0.03em tracking, producing a compressed, editorial presence. Also carries body text at 18px (lh 1.62) and UI labels at 13–14px. Its humanist warmth prevents the dark canvas from feeling cold or corporate.
- **Substitute:** Söhne, Inter, or system-ui
- **Weights:** 400
- **Sizes:** 13px, 14px, 18px, 58px, 72px
- **Line height:** 0.90, 1.06, 1.20, 1.25, 1.62
- **Letter spacing:** -0.0300em

### JetBrains Mono — Interface annotations, data labels, button text, tag values, and secondary display moments. The monospaced geometry reads as coordinates, timestamps, and telemetry — reinforcing the field-instrument metaphor. Set in weight 300 for hero-scale data callouts (65px) to keep mono from feeling mechanical at large sizes.
- **Substitute:** JetBrains Mono, IBM Plex Mono, or Space Mono
- **Weights:** 300, 400, 700
- **Sizes:** 13px, 14px, 18px, 29px, 65px
- **Line height:** 1.20, 1.25, 1.28
- **Letter spacing:** normal

### Type Scale

| Role | Family | Weight | Size | Line Height | Letter Spacing |
|------|--------|--------|------|-------------|----------------|
| caption | — | — | 13px | 1.2 | 0px |
| body | — | — | 18px | 1.62 | -0.54px |
| subheading | — | — | 29px | 1.28 | 0px |
| heading | — | — | 58px | 1.06 | -1.74px |
| display | — | — | 72px | 0.9 | -2.16px |

## Spacing & Layout

**Density:** comfortable

- **Page max-width:** 1200px
- **Section gap:** 86-104px
- **Card padding:** 14-18px
- **Element gap:** 18px

### Border Radius

- **tags:** 3.6px
- **cards:** 0px
- **inputs:** 3.6px
- **buttons:** 3.6px

## Components

### Hero Headline
**Role:** Primary page-level statement, 58–72px

NB International Pro weight 400, 72px, line-height 0.90, letter-spacing -2.16px, color #f4f3e8. Sits bottom-left over full-bleed image with no background treatment. The extreme line-height (0.90) stacks lines tightly into a single block, creating weight without weight-of-stroke.

### Lime Action Button
**Role:** Primary call-to-action, high-emphasis interactive

Background #ebfc72, text #13140, font JetBrains Mono weight 400 at 14px, padding 14px 18px, border-radius 3.6px, uppercase letter spacing. The button is the only high-saturation element on the page — its presence makes it impossible to miss without needing size or shadow emphasis.

### Ghost Text Button
**Role:** Secondary action, low-emphasis interactive

Transparent background, text #f4f3e8, border optional 1px #404040, JetBrains Mono 14px, 3.6px radius. Used for navigation items and secondary links in dark contexts.

### Data Tag
**Role:** Coordinate, label, or classification marker

Background #ebfc72 or transparent with #ebfc72 border, text #13140 or #f4f3e8, JetBrains Mono 13px weight 400, padding 5px 7px, 3.6px radius. Functions as the 'survey marker' of the system — small, bright, unmistakable.

### Top Navigation Bar
**Role:** Site-wide header

Transparent over hero, fixed/sticky. Left: brand wordmark 'INVERSA' in NB International Pro 14px #f4f3e8. Right: 'Menu' trigger in JetBrains Mono 13px #f4f3e8 with small indicator dot. No background fill, no border — the nav floats on the image.

### Full-Bleed Image Band
**Role:** Atmospheric section separator or context image

Edge-to-edge photographic imagery (aerial/satellite) with no radius, no border, no overlay. Sits at 100vw. Provides the only color in the system outside the lime accent.

### Text Block (Dark Surface)
**Role:** Contained editorial content on canvas

No card chrome — content sits directly on #13140e. Headings in NB International Pro 58px #f4f3e8, body in 18px #f4f3e8 lh 1.62. No background fill, no border, no shadow. Spacing between blocks: 18px element gap, 86–104px section gap.

### Footer
**Role:** Site footer

Full-width dark #13140 band. Top border 1px #404040. Content in JetBrains Mono 13px #f4f3e8. Sparse — typically 2–3 columns of links and metadata.

### Input Field
**Role:** Text input

Transparent background on dark canvas, bottom border only 1px #404040, text in NB International Pro 14px #f4f3e8, placeholder #84837b. No fill, no radius on the field — the underline IS the field.

## Do's and Don'ts

### Do
- Set hero headlines at 58–72px NB International Pro weight 400 with line-height 0.90 and letter-spacing -0.03em — the tight leading stacks lines into a single mass.
- Use #ebfc72 as the sole chromatic accent for any element that needs to be noticed: buttons, active states, data tags, and icon highlights.
- Apply -0.03em letter-spacing to all NB International Pro text regardless of size — the tracking is part of the brand voice, not a display-only treatment.
- Let imagery bleed to all four edges at 100vw with zero radius, zero border, and zero overlay — the photo is the surface.
- Set all UI labels, button text, and metadata in JetBrains Mono — the mono voice distinguishes interface from editorial copy.
- Use 3.6px border-radius consistently for buttons, tags, and inputs — do not introduce larger radii for 'softness'.
- Space sections at 86–104px and separate them with whitespace, not dividers or background color shifts.

### Don't
- Do not add box-shadows to any element — the system is deliberately flat; depth comes from color contrast, not elevation.
- Do not introduce a second accent color — the lime is alone by design. Any other chromatic addition dilutes the survey-marker effect.
- Do not set body text below 18px in NB International Pro — the font's humanist proportions require generous size to read correctly.
- Do not use #000000 as the canvas — the olive undertone of #13140 is what makes the dark feel organic rather than digital.
- Do not round corners beyond 3.6px on any component — larger radii would contradict the instrument-panel aesthetic.
- Do not use colored backgrounds for cards or content blocks — content sits directly on the dark canvas with no chrome.
- Do not center body text — editorial alignment is left-aligned throughout, matching the mission-log reading flow.

## Elevation

The system is deliberately shadowless. All depth is communicated through color contrast (lime on black) and typographic scale rather than box-shadow elevation. The near-zero border radius and absence of shadows give every element a flat, instrument-panel quality — surfaces feel like etched markings, not stacked cards.

## Surfaces

- **Obsidian Loam** (`#13140`) — Page canvas, hero background, full-bleed image overlay base
- **Iron Filings** (`#404040`) — Hairline borders, footer rule lines, low-emphasis dividers

## Imagery

Full-bleed aerial and satellite photography of coastline, estuaries, and terrain — the imagery IS the atmosphere, not decoration. Photos span edge-to-edge with no framing, border, or radius. Color treatment is naturalistic (greens, earth tones, water blues) allowed to carry the only chromatic weight in the system, while overlaid UI remains monochrome. No product screenshots, no illustrations, no abstract graphics — the site is a map and a logbook, not a brochure.

## Layout

Full-bleed dark canvas with content anchored to a max-width 1200px column. The hero is a full-viewport satellite image with bottom-left text overlay — a massive 72px headline, a lime-filled action button directly below, and minimal nav (brand wordmark top-left, menu top-right). Sections are separated by generous 86–104px vertical gaps rather than dividers, creating a sense of topographic sheets laid on a dark surface. Content alternates between full-bleed image bands and contained text blocks. The grid is narrow (2–3 columns max) — this is not a dense dashboard but a reading surface for mission briefings.

## Similar Brands

- **Planet Labs** — Same full-bleed satellite earth photography as the visual backbone, dark canvas, and single-color data annotation approach
- **Sentinel Hub** — Identical top-map-as-hero pattern with minimal text overlay and utilitarian interface chrome
- **Radiant Earth** — Dark-mode conservation/earth-observation aesthetic with editorial-scale type and restrained accent usage
- **Stripe Press** — Same editorial use of NB International-style humanist sans at large compressed sizes on dark backgrounds, treated like a publication rather than a product
- **Vercel** — Near-identical typographic attitude — dark canvas, mono for UI labels, humanist sans for headlines, zero-radius buttons, and shadowless flat surfaces
````

</details>

#### CSS Variables — Extended (verbatim)

````css
:root {
  /* Colors */
  --color-obsidian-loam: #13140e;
  --color-bone-vellum: #f4f3e8;
  --color-iron-filings: #404040;
  --color-drift-ash: #84837b;
  --color-lime-surveyor: #ebfc72;
  --color-marsh-olive: #bacd31;

  /* Typography — Font Families */
  --font-nb-international-pro: 'NB International Pro', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-jetbrains-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  /* Typography — Scale */
  --text-caption: 13px;
  --leading-caption: 1.2;
  --tracking-caption: 0px;
  --text-body: 18px;
  --leading-body: 1.62;
  --tracking-body: -0.54px;
  --text-subheading: 29px;
  --leading-subheading: 1.28;
  --tracking-subheading: 0px;
  --text-heading: 58px;
  --leading-heading: 1.06;
  --tracking-heading: -1.74px;
  --text-display: 72px;
  --leading-display: 0.9;
  --tracking-display: -2.16px;

  /* Typography — Weights */
  --font-weight-light: 300;
  --font-weight-regular: 400;
  --font-weight-bold: 700;

  /* Spacing */
  --spacing-5: 5px;
  --spacing-7: 7px;
  --spacing-14: 14px;
  --spacing-18: 18px;
  --spacing-21: 21px;
  --spacing-29: 29px;
  --spacing-59: 59px;
  --spacing-86: 86px;
  --spacing-104: 104px;
  --spacing-119: 119px;

  /* Layout */
  --page-max-width: 1200px;
  --section-gap: 86-104px;
  --card-padding: 14-18px;
  --element-gap: 18px;

  /* Border Radius */
  --radius-md: 3.6px;

  /* Named Radii */
  --radius-tags: 3.6px;
  --radius-cards: 0px;
  --radius-inputs: 3.6px;
  --radius-buttons: 3.6px;

  /* Surfaces */
  --surface-obsidian-loam: #13140;
  --surface-iron-filings: #404040;
}
````

#### CSS Variables — Compact (verbatim)

````css
:root {
  /* Colors */
  --color-obsidian-loam: #13140e;
  --color-bone-vellum: #f4f3e8;
  --color-iron-filings: #404040;
  --color-drift-ash: #84837b;
  --color-lime-surveyor: #ebfc72;
  --color-marsh-olive: #bacd31;

  /* Typography — Font Families */
  --font-nb-international-pro: 'NB International Pro', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-jetbrains-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
````

#### Tailwind v4 — Extended (verbatim)

````css
@theme {
  /* Colors */
  --color-obsidian-loam: #13140e;
  --color-bone-vellum: #f4f3e8;
  --color-iron-filings: #404040;
  --color-drift-ash: #84837b;
  --color-lime-surveyor: #ebfc72;
  --color-marsh-olive: #bacd31;

  /* Typography */
  --font-nb-international-pro: 'NB International Pro', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-jetbrains-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  /* Typography — Scale */
  --text-caption: 13px;
  --leading-caption: 1.2;
  --tracking-caption: 0px;
  --text-body: 18px;
  --leading-body: 1.62;
  --tracking-body: -0.54px;
  --text-subheading: 29px;
  --leading-subheading: 1.28;
  --tracking-subheading: 0px;
  --text-heading: 58px;
  --leading-heading: 1.06;
  --tracking-heading: -1.74px;
  --text-display: 72px;
  --leading-display: 0.9;
  --tracking-display: -2.16px;

  /* Spacing */
  --spacing-5: 5px;
  --spacing-7: 7px;
  --spacing-14: 14px;
  --spacing-18: 18px;
  --spacing-21: 21px;
  --spacing-29: 29px;
  --spacing-59: 59px;
  --spacing-86: 86px;
  --spacing-104: 104px;
  --spacing-119: 119px;

  /* Border Radius */
  --radius-md: 3.6px;
}
````

#### Tailwind v4 — Compact (verbatim)

````css
@theme {
  /* Colors */
  --color-obsidian-loam: #13140e;
  --color-bone-vellum: #f4f3e8;
  --color-iron-filings: #404040;
  --color-drift-ash: #84837b;
  --color-lime-surveyor: #ebfc72;
  --color-marsh-olive: #bacd31;

  /* Typography */
  --font-nb-international-pro: 'NB International Pro', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-jetbrains-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
````

#### Design Tokens — Extended (verbatim)

````json
{
  "color": {
    "obsidian-loam": {
      "$value": "#13140e",
      "$type": "color",
      "$description": "Obsidian Loam — Page canvas, hero background, card surfaces — the near-black base with a faint olive cast that keeps the dark from feeling synthetic"
    },
    "bone-vellum": {
      "$value": "#f4f3e8",
      "$type": "color",
      "$description": "Bone Vellum — Primary text, body copy, headings, icon strokes, border color on dark — warm off-white that reads as paper, not LCD white"
    },
    "iron-filings": {
      "$value": "#404040",
      "$type": "color",
      "$description": "Iron Filings — Hairline borders, footer dividers, low-emphasis rules"
    },
    "drift-ash": {
      "$value": "#84837b",
      "$type": "color",
      "$description": "Drift Ash — Muted secondary text, placeholder input state, low-contrast labels on light surfaces"
    },
    "lime-surveyor": {
      "$value": "#ebfc72",
      "$type": "color",
      "$description": "Lime Surveyor — Green supporting accent for decorative details and low-frequency emphasis. Do not promote it to the primary CTA color"
    },
    "marsh-olive": {
      "$value": "#bacd31",
      "$type": "color",
      "$description": "Marsh Olive — Gradient transition shade for the lime accent — deeper stop used in horizontal lime fades"
    }
  },
  "font": {
    "nb-international-pro": {
      "$value": "NB International Pro",
      "$type": "fontFamily",
      "$description": "Display and body — the brand's primary voice. Set at 72px for hero statements and 58px for section headers with -0.03em tracking, producing a compressed, editorial presence. Also carries body text at 18px (lh 1.62) and UI labels at 13–14px. Its humanist warmth prevents the dark canvas from feeling cold or corporate."
    },
    "jetbrains-mono": {
      "$value": "JetBrains Mono",
      "$type": "fontFamily",
      "$description": "Interface annotations, data labels, button text, tag values, and secondary display moments. The monospaced geometry reads as coordinates, timestamps, and telemetry — reinforcing the field-instrument metaphor. Set in weight 300 for hero-scale data callouts (65px) to keep mono from feeling mechanical at large sizes."
    }
  },
  "typography": {
    "sm": {
      "$value": {
        "fontFamily": "JetBrains Mono",
        "fontSize": "13px",
        "fontWeight": 300,
        "lineHeight": 1.28,
        "letterSpacing": "0em"
      },
      "$type": "typography",
      "$description": "Typography step sm at 13px"
    },
    "sm-2": {
      "$value": {
        "fontFamily": "NB International Pro",
        "fontSize": "13px",
        "fontWeight": 400,
        "lineHeight": 1.25,
        "letterSpacing": "0em"
      },
      "$type": "typography",
      "$description": "Typography step sm-2 at 13px"
    },
    "sm-3": {
      "$value": {
        "fontFamily": "JetBrains Mono",
        "fontSize": "14px",
        "fontWeight": 400,
        "lineHeight": 1.2,
        "letterSpacing": "0em"
      },
      "$type": "typography",
      "$description": "Typography step sm-3 at 14px"
    },
    "sm-4": {
      "$value": {
        "fontFamily": "NB International Pro",
        "fontSize": "14px",
        "fontWeight": 400,
        "lineHeight": 1.2,
        "letterSpacing": "0em"
      },
      "$type": "typography",
      "$description": "Typography step sm-4 at 14px"
    },
    "sm-5": {
      "$value": {
        "fontFamily": "NB International Pro",
        "fontSize": "14px",
        "fontWeight": 400,
        "lineHeight": 1.62,
        "letterSpacing": "0em"
      },
      "$type": "typography",
      "$description": "Typography step sm-5 at 14px"
    },
    "lg": {
      "$value": {
        "fontFamily": "JetBrains Mono",
        "fontSize": "18px",
        "fontWeight": 300,
        "lineHeight": 1.25,
        "letterSpacing": "0em"
      },
      "$type": "typography",
      "$description": "Typography step lg at 18px"
    },
    "lg-2": {
      "$value": {
        "fontFamily": "NB International Pro",
        "fontSize": "18px",
        "fontWeight": 400,
        "lineHeight": 1.25,
        "letterSpacing": "0em"
      },
      "$type": "typography",
      "$description": "Typography step lg-2 at 18px"
    },
    "2xl": {
      "$value": {
        "fontFamily": "JetBrains Mono",
        "fontSize": "29px",
        "fontWeight": 700,
        "lineHeight": 1.2,
        "letterSpacing": "0em"
      },
      "$type": "typography",
      "$description": "Typography step 2xl at 29px"
    },
    "5xl": {
      "$value": {
        "fontFamily": "NB International Pro",
        "fontSize": "58px",
        "fontWeight": 400,
        "lineHeight": 1.06,
        "letterSpacing": "-0.03em"
      },
      "$type": "typography",
      "$description": "Typography step 5xl at 58px"
    },
    "5xl-2": {
      "$value": {
        "fontFamily": "JetBrains Mono",
        "fontSize": "65px",
        "fontWeight": 400,
        "lineHeight": 1.2,
        "letterSpacing": "0em"
      },
      "$type": "typography",
      "$description": "Typography step 5xl-2 at 65px"
    },
    "5xl-3": {
      "$value": {
        "fontFamily": "NB International Pro",
        "fontSize": "72px",
        "fontWeight": 400,
        "lineHeight": 0.9,
        "letterSpacing": "-0.03em"
      },
      "$type": "typography",
      "$description": "Typography step 5xl-3 at 72px"
    }
  },
  "spacing": {
    "5": {
      "$value": "5px",
      "$type": "dimension",
      "$description": "Spacing 5px"
    },
    "7": {
      "$value": "7px",
      "$type": "dimension",
      "$description": "Spacing 7px"
    },
    "14": {
      "$value": "14px",
      "$type": "dimension",
      "$description": "Spacing 14px"
    },
    "18": {
      "$value": "18px",
      "$type": "dimension",
      "$description": "Spacing 18px"
    },
    "21": {
      "$value": "21px",
      "$type": "dimension",
      "$description": "Spacing 21px"
    },
    "29": {
      "$value": "29px",
      "$type": "dimension",
      "$description": "Spacing 29px"
    },
    "59": {
      "$value": "59px",
      "$type": "dimension",
      "$description": "Spacing 59px"
    },
    "86": {
      "$value": "86px",
      "$type": "dimension",
      "$description": "Spacing 86px"
    },
    "104": {
      "$value": "104px",
      "$type": "dimension",
      "$description": "Spacing 104px"
    },
    "119": {
      "$value": "119px",
      "$type": "dimension",
      "$description": "Spacing 119px"
    }
  },
  "radius": {
    "md": {
      "$value": "3.6px",
      "$type": "dimension",
      "$description": "Border radius md"
    }
  },
  "surface": {
    "obsidian-loam": {
      "$value": "#13140",
      "$type": "color",
      "$description": "Surface level 1: Page canvas, hero background, full-bleed image overlay base"
    },
    "iron-filings": {
      "$value": "#404040",
      "$type": "color",
      "$description": "Surface level 2: Hairline borders, footer rule lines, low-emphasis dividers"
    }
  },
  "$extensions": {
    "com.refero.extraction": {
      "url": "https://inversa.com",
      "siteName": "INVERSA",
      "extractedAt": "2026-06-03T20:30:47.778Z",
      "variant": "extended"
    }
  }
}
````

#### Design Tokens — Compact (verbatim)

````json
{
  "color": {
    "obsidian-loam": {
      "$value": "#13140e",
      "$type": "color",
      "$description": "Obsidian Loam — Page canvas, hero background, card surfaces — the near-black base with a faint olive cast that keeps the dark from feeling synthetic"
    },
    "bone-vellum": {
      "$value": "#f4f3e8",
      "$type": "color",
      "$description": "Bone Vellum — Primary text, body copy, headings, icon strokes, border color on dark — warm off-white that reads as paper, not LCD white"
    },
    "iron-filings": {
      "$value": "#404040",
      "$type": "color",
      "$description": "Iron Filings — Hairline borders, footer dividers, low-emphasis rules"
    },
    "drift-ash": {
      "$value": "#84837b",
      "$type": "color",
      "$description": "Drift Ash — Muted secondary text, placeholder input state, low-contrast labels on light surfaces"
    },
    "lime-surveyor": {
      "$value": "#ebfc72",
      "$type": "color",
      "$description": "Lime Surveyor — Green supporting accent for decorative details and low-frequency emphasis. Do not promote it to the primary CTA color"
    },
    "marsh-olive": {
      "$value": "#bacd31",
      "$type": "color",
      "$description": "Marsh Olive — Gradient transition shade for the lime accent — deeper stop used in horizontal lime fades"
    }
  },
  "font": {
    "nb-international-pro": {
      "$value": "NB International Pro",
      "$type": "fontFamily",
      "$description": "Display and body — the brand's primary voice. Set at 72px for hero statements and 58px for section headers with -0.03em tracking, producing a compressed, editorial presence. Also carries body text at 18px (lh 1.62) and UI labels at 13–14px. Its humanist warmth prevents the dark canvas from feeling cold or corporate."
    },
    "jetbrains-mono": {
      "$value": "JetBrains Mono",
      "$type": "fontFamily",
      "$description": "Interface annotations, data labels, button text, tag values, and secondary display moments. The monospaced geometry reads as coordinates, timestamps, and telemetry — reinforcing the field-instrument metaphor. Set in weight 300 for hero-scale data callouts (65px) to keep mono from feeling mechanical at large sizes."
    }
  },
  "$extensions": {
    "com.refero.extraction": {
      "url": "https://inversa.com",
      "siteName": "INVERSA",
      "extractedAt": "2026-06-03T20:30:47.778Z",
      "variant": "compact"
    }
  }
}
````

### Fields not on the page

- Base unit: not on the page (Spacing table has no base-unit row; DESIGN.md has no **Base unit:** line).
- Shadow/elevation values: not on the page (explicitly none).
- Motion/animation tokens: not on the page.
- Card radius: only in DESIGN.md (`cards: 0px`), not in the on-page Border Radius table (which lists Tags, Inputs, Buttons at 3.6px).
- Page text quirks preserved verbatim: `#13140` (truncated hex) appears in DESIGN.md Surfaces, components, a Don't, and `--surface-obsidian-loam: #13140;`; `--section-gap: 86-104px;` and `--card-padding: 14-18px;` are not valid CSS lengths. Lime Surveyor's role says 'Do not promote it to the primary CTA color' while the Do list, components and the live site use it as the CTA fill.

### Source-site screenshots and observations

Desktop 1440x900: `work/design/source/refero-2-desktop.png`

1. Hierarchy: a full-bleed aerial estuary photo fills the 1440x900 viewport edge to edge. The only text is 'Invasions move fast. Be faster.' in NB International Pro, measured at 72px, weight 400, letter-spacing -2.16px (-0.03em), Bone Vellum, two tightly leaded lines at the bottom-left about 16px from the edge. The hero ignores the 1200px column. The nav floats on the image with no background: 'INVERSA' at 14px top-left, 'Menu' plus a crosshair glyph top-right, and a thin bracket scroll indicator on the right edge.
2. Buttons: 'EXPLORE ORIGIN' measured as background rgb(235, 252, 114) = #ebfc72, text rgb(19, 20, 14) = #13140e, JetBrains Mono 12.6px caps, padding 0 18px, border-radius 3.6px, plus `clip-path: polygon(0px 0px, 100% 0px, 100% calc(100% - 13.5px), calc(100% - 13.5px) 100%, 0px 100%, 0px 0px)`, which chamfers the bottom-right corner by 13.5px. It is the only saturated element on screen. The chamfer is not mentioned on the Refero page.
3. Motion and density: first paint is a loader on #13140e with a dotted grid (dots about every 126px), a thin ruled strip that reveals the photo, and mono telemetry 'PHASE 8% / FREQ 16HZ'. Measured transitions: opacity 0.2s linear, color 0.25s linear, transform 0.25s linear, clip-path 0.25s ease-out, height 1s ease-in-out, which reads as mechanical and linear. Measured type: NB International Pro 18px dominates the DOM (1505 nodes), plus 72px, 57.6px, 14.4px and 12.6px; JetBrains Mono at 9.9/12.6/14.4/18/28.8/64.8px with weights 300/400/700. These multiples of 0.9 suggest a fluid rem scale behind Refero's rounded 13/14/58/65px values.

Mobile 375x812: `work/design/source/refero-2-mobile.png`

1. Motion: at 375x812 the loader stayed up for about 45s. It shows an outlined 'LOADING...' box (1px Bone Vellum border, square corners, mono caps), 'PHASE 0% / FREQ 16HZ' readouts and double hairline rules, all on the dotted-grid canvas.
2. Hierarchy: the hero photo does not fill the screen. It sits as a mid-screen band whose top and bottom edges are stepped like pixels (a stair mask reveal) over Obsidian Loam, and the dot grid stays visible above and below. This shows the canvas and the 'topographic sheet' layering more clearly than the desktop view.
3. Density and buttons: one statement and one CTA per viewport. The headline 'Invasions move fast. Be faster.' wraps to two lines at about 44px with the same tight leading and negative tracking, inside a gutter of about 12px. The lime 'EXPLORE ORIGIN' button keeps its chamfered corner, and the nav (wordmark plus 'Menu' crosshair) is unchanged from desktop.
