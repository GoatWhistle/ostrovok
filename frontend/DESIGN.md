---
name: "О!дин шаг до идеального отеля"
description: "Mapbox-inspired workspace for hotel facts and geographic evidence"
colors:
  "deep-signal": "#0062ca"
  "signal-blue": "#007afc"
  "void-black": "#0e1012"
  "deep-charcoal": "#15171b"
  "gunmetal": "#1c1f24"
  "graphite": "#23262d"
  "white": "#ffffff"
  "silver": "#bbc2ce"
  "fog": "#a0aaba"
  "light-base": "#f6f6f7"
  "light-sunken": "#ececee"
  "light-ink": "#1a1a1e"
  "light-secondary": "#54545c"
  "light-muted": "#686872"
  "danger-light": "#c4322f"
  "danger-dark": "#f59a9a"
  "success-light": "#1d7a45"
  "success-dark": "#7fd1a0"
  "warning-light": "#8f5a00"
  "warning-dark": "#f2c46d"
typography:
  heading-lg:
    fontFamily: "\"Cera Pro\", ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "clamp(1.5rem, 1.2rem + 1vw, 2rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.015em"
  heading:
    fontFamily: "\"Cera Pro\", ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.015em"
  subheading:
    fontFamily: "\"Cera Pro\", ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.015em"
  body:
    fontFamily: "\"Cera Pro\", ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  body-sm:
    fontFamily: "\"Cera Pro\", ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "\"Cera Pro\", ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
  caption:
    fontFamily: "\"Cera Pro\", ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  "sm": "4px"
  "md": "6px"
  "lg": "24px"
  "pill": "100px"
spacing:
  "2": "2px"
  "4": "4px"
  "8": "8px"
  "12": "12px"
  "16": "16px"
  "20": "20px"
  "24": "24px"
  "32": "32px"
  "40": "40px"
  "48": "48px"
  "64": "64px"
components:
  button-primary:
    backgroundColor: "{colors.deep-signal}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-secondary:
    backgroundColor: "transparent"
    rounded: "{rounded.pill}"
    typography: "{typography.label}"
    padding: "0 20px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    rounded: "{rounded.pill}"
    typography: "{typography.label}"
    padding: "0 12px"
    height: "44px"
  field:
    rounded: "{rounded.md}"
    padding: "12px 16px"
    typography: "{typography.body}"
  card:
    rounded: "{rounded.lg}"
    padding: "24px"
  characteristic-chip:
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
    typography: "{typography.label}"
  navigation:
    typography: "{typography.body-sm}"
    height: "44px"
  map-stage:
    rounded: "{rounded.lg}"
    height: "560px"
---

# Design System: О!дин шаг до идеального отеля

## Overview

**Creative North Star: "Mapbox"**

The user-selected Mapbox world gives this workspace its dark layered surfaces, blue actions, pill controls and quiet geometric type character. The light theme keeps the same hierarchy and control language. Color makes selection legible while hotel facts and their sources carry the content.

The implemented interface is a full-width working surface with rounded panels, a results rail and a geographic scene. Its depth comes from solid surface tones and fine borders. Empty, unavailable and unknown information remain visibly different states; the map never supplies decorative replacement data.

**Key Characteristics:**

- Layered neutral surfaces with blue actions and geographic selection.
- Rounded content panels and pill-shaped actions.
- Compact readable typography in RU and EN.
- API-backed facts, geometry and explicit unavailable states.

This records the implemented frontend. The normative runtime values live in `src/shared/styles/tokens/`; the frontmatter is an extracted portable snapshot. Component CSS and the semantic theme layer remain the implementation source of truth.

## Colors

### Primary

Deep Signal is the solid action color in both themes. Signal Blue supplies the dark-theme focus ring and map accent; light-theme focus and map selection use Deep Signal. Primary button hover and press currently retain the same fill and add the shared press response.

### Neutral

Dark mode layers Void Black for the page, Deep Charcoal for raised panels, Gunmetal for sunken fields and the map, and Graphite for selected results. White carries primary text, Silver supporting text and Fog quiet text.

Light mode uses Light Base for the page, White for raised and selected surfaces, Light Sunken for recessed fields, Light Ink for primary text, Light Secondary for supporting text and Light Muted for captions. Borders and hover fills are theme-aware `color-mix(in oklab, …)` values from `semantic.css`, not separate component palettes.

Success, warning and danger use their light/dark pairs for readable status text. The selected reference's green remains a palette asset; the implemented status colors are the semantic success pair.

**The Semantic Roles Rule.** Components read semantic tokens; the light and dark themes assign their values. Blue identifies actions, focus and geographic selection. Status always includes text or an icon.

## Typography

**Display and Body Font:** Cera Pro with the system sans fallback recorded in the frontmatter. There is no separate decorative display face.

**Label/Mono Font:** JetBrains Mono Variable, JetBrains Mono, system monospace fallbacks, reserved for codes and identifiers. Local font packages are bundled; Cera Pro is absent. The imported Inter package is not the selected sans family in the implemented stack.

The scale runs from caption through label, small body, body, subheading, heading and fluid heading. The search heading uses bold; shared headings use semibold. Supporting copy uses regular weight and controls medium. Heading tracking is tight, while body tracking is normal. Sentence case and natural wrapping support both UI languages. Aligned numeric data uses tabular figures and locale-aware formatting.

**The Available Font Rule.** Cera Pro names the intended family, but no licensed Cera Pro files are supplied or downloaded. The sans stack falls back to the local system; preserve this fallback rather than assuming the font is installed.

## Layout

The header wraps brand, navigation and language/theme controls. The workspace has a results/search rail (360px), a flexible map column and gaps (24px). At wide desktop widths (90rem), selected hotel details can share the canvas row using another rail. Below desktop (64rem), list and map use separate selectable views. The header navigation wraps below its other controls below tablet (48rem).

Page gutters use the regular spacing step (24px), becoming wide gutters (32px) from 75rem. Reused content gaps follow the frontmatter spacing scale. Prose has a readable measure (70ch); individual fields may be bounded (480px). The map stage has a desktop minimum height (560px) and a mobile minimum (420px). Its controls wrap on small screens.

**The Full Workspace Rule.** Fill the available width with useful panels. Constrain prose and individual fields, not the application canvas.

## Elevation & Depth

Solid tonal layers and hairline borders establish the resting hierarchy. Shared cards have no floating shadow. Secondary buttons use an inset ring, segmented selection a small raised shadow, and floating layers the compound overlay shadow. Exact formulas remain in `elevation.css` and the sidecar; their shadow color follows the theme.

**The Surface Before Shadow Rule.** Use solid raised and sunken surfaces with subtle borders first. Reserve floating shadows for overlays and the small raised shadow for selection.

## Shapes

Content cards, the map stage and the results rail use broad rounded corners from the large radius token. Primary, secondary and ghost buttons share the pill silhouette. Text fields use the smaller medium corner, while segmented tracks use the large corner with smaller individual targets. Thin borders define control edges without colored card stripes.

## Components

### Buttons

Primary buttons use action fill and white text; secondary buttons use a transparent fill and inset outline; ghost buttons omit the outline. Standard actions use a minimum control height (44px) and horizontal padding (20px), with tighter ghost padding (12px). Compact variants have a visual height (36px) with an expanded touch target (44px). Icons accompany actions. Pending buttons keep their width, replace visible content with the loader, and expose `aria-busy`.

Fine-pointer hover uses semantic hover tokens. Press uses the shared scale (0.97); keyboard focus uses a visible outline (2px) and offset (2px). Shared short transitions use token durations and easing. Reduced motion neutralizes movement and compresses durations, with short fades where explicitly requested.

### Chips

Characteristic suggestions and selected regions reuse button primitives rather than a separate chip skin. Suggestions are outlined pill actions that append a server-provided characteristic title to the query. Selected regions use the primary variant. Property actions connect result text to geographic evidence through hover, focus and activation.

### Cards / Containers

Cards use a solid raised surface, subtle hairline border, large rounded corners and card padding (24px). Hotel results share the rail, separated by a fine horizontal line; selection changes the surface tone. Fact details keep source, status and actions together. Repeated unknown values retain the shared unknown-value treatment.

### Inputs / Fields

Text fields use a sunken surface, strong hairline border, medium corners and internal padding (12px 16px). Labels sit above the field and placeholders use muted text. The search textarea has a minimum height (160px) and can resize vertically. Visible keyboard focus is shared with the rest of the interface.

### Navigation

The header uses icon-and-text links with supporting text at rest. Current navigation uses primary text and medium weight. Theme and locale switches are shared segmented controls with a sunken track and raised selected surface. The theme switch exposes light and dark choices; the saved choice takes precedence over the system preference. RU is the product default, with EN supported through the same interface dictionaries.

### Geographic scene

MapLibre initializes with an empty local style: no external basemap, raster tiles or terrain source is configured. Theme tokens supply the scene background, context building tone and focus accent. Buildings, outlines, selected points, lines, polygons and facade highlights come from API data. The selected hotel receives the accent; other volumes use muted text color. Scene warnings identify invalid geometry or missing heights. Without a camera the stage shows its empty state; WebGL failure leaves the list and facts available.

**The Real Geometry Rule.** Render only validated GeoJSON supplied by the API. Extrude using supplied height_m and min_height_m; missing height produces a flat outline and a warning. Do not fabricate a building height.

Camera changes stop the previous move. Reduced motion uses `jumpTo`; otherwise the API camera duration or shared draw duration applies. The overview control restores the supplied camera immediately.

### Data states

Loading, empty, API error, unavailable region and missing scene are separate states. Retry actions use the same button language. The backend currently serves health and characteristics; the other contracted screens display unavailable responses until their methods exist. This design record does not claim a completed search backend.

**The Honest State Rule.** Unavailable API methods show an error or unavailable state with retry where provided. An error is never presented as an empty successful search or replaced with sample hotel data.

## Do's and Don'ts

### Do:

- Do use the shared semantic tokens in both themes.
- Do preserve pill actions, rounded panels and visible keyboard focus.
- Do supply RU and EN interface copy through dictionaries; preserve the language of server content.
- Do keep the hotel list and facts usable when WebGL fails.
- Do distinguish loading, empty, unknown and failed states with text and appropriate icons.
- Do interrupt a map camera move when a newer selection arrives and use an immediate camera jump for reduced motion.

### Don't:

- Don't load an external basemap or terrain in the current scene.
- Don't invent hotels, geographic features, building heights or evidence to fill an empty view.
- Don't download commercial Cera Pro font files or rely on remote font services.
- Don't use gradients, glass or decorative effects that compete with geographic evidence.
- Don't communicate status through color alone.
- Don't turn the working surface into a narrow marketing column.
