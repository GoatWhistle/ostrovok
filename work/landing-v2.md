# Landing v2 and polish — plan (2026-10-25)

Feedback source: user messages in session, 2026-10-25.

## Stages

1. [x] Resize handle: thin 1–2px line instead of the 12px tint band; no map jitter (agent).
2. [x] Map: "3D map is unavailable" only on WebGL/init failure, never on tile errors (agent).
3. [x] Theme/locale switch lag on the landing: map freezes during the reveal transition (agent).
4. [x] Landing without the app header: no logo/nav strip; a gear button top-right opens theme + language.
5. [x] Landing visual: right half is a non-interactive 3D terrain reel (9 shots across Russia, own sun
       per shot, cross-fade, next shot's DEM tiles prefetched). Shapes and caption card were removed
       on user feedback; split screen only.
6. [x] Remove region stats ("Россия: 31,891 hotels") from the landing card.
7. [x] Map attribution out of the visual: compact "i" toggle (OSM ODbL still requires attribution).
8. [x] Center the landing card on wide screens; mobile layout check at 390px.
9. [x] Verify (npm run verify), visual check 1440/2000/390 both themes RU/EN, commit, rebase, push.

## Ownership while agents run

- Agent "resize": `shared/hooks/use-resizable.ts`, `shared/ui/layout/resize-handle/*`.
- Agent "map-perf": `features/hotel-map/use-hotel-map.ts`, `features/hotel-map/map-status.tsx`,
  `shared/motion/reveal-transition.ts`, `features/locale-switch/*`, `features/theme-switch/*`.
- Main: `pages/home/*`, `features/search-chat/*`, `app/*`, new landing feature, i18n json.

## Follow-up feedback handled

- Settings popover: language and theme are both segmented controls; hotelier link below a divider.
- Logo lockup on the landing with contour rings and a ripple drawn from the mark.
- Send button centred on the first line of the composer (`SearchBox .actions`).
- Map pixel ratio capped at 1.5 on both maps.

## Known limitation

- Terrain shows dotted terrace lines on gentle slopes: the DEM source is quantized; backend encoding is
  0.1 m, so the steps come from the source heights. Not fixed on the frontend.
