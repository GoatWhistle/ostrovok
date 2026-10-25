# Selected hotel texture

Mode: Operate. Extend the current Factmap map without changing panels, typography, colors or controls.
The user selects a hotel in the list or on the map; its API footprint gains textured walls and a roof.
Only the active hotel's footprints enter the custom 3D layer. Ordinary neighboring buildings remain.
Clearing selection removes the texture. Switching selection releases the previous GPU buffers and texture.

Source: `HotelScene.building` when `hotel_id` matches, otherwise that selected result's footprint while
the scene loads. Do not use `is_hotel` to select every hotel in the scene. No footprint or finite positive
height means no invented volume. Support multipolygons, inner courtyards and API minimum heights.
The texture is illustrative and says so in RU/EN. An image or shader failure preserves the ordinary volume.

## Direction contract

THESIS: the selected hotel becomes legible through a textured facade directly on the existing map.
OWN-WORLD: inherit Factmap's map palette, controls, warnings, language and theme behavior.
STORY: select one hotel, inspect its walls and roof, switch to another; only the selection is textured.
FIRST VIEWPORT: existing hotel panel, central map and chat; one textured building in its real location.
FORM: local extension, code-led, no new surface or aesthetic choice.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict,
DESIGN.md, and every shipping raster carrying its provenance.

## Verification

Selection and deselection, stale scene, absent height/footprint, courtyards and multipart geometry;
live saved conversations without new paid model calls; GPU draw/resource instrumentation from tests;
375/1440 px, RU/EN, both themes; delayed or failed texture and WebGL context restoration.
The appearance is a reusable synthetic material, not evidence of real facade detail.
