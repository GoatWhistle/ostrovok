# Measurement protocol

Fixed before the performance run, 2026-10-26.

- One Chromium (version recorded in JSON) process, one page at a time; WSL2, ANGLE SwiftShader software rendering. These results cannot certify integrated GPU or physical phone budgets.
- Five styles, same Adler export, z16, pitch60, center Cosmos. 1440×1000 DPR1 and emulated 375×812 DPR2 with CDP 4× CPU throttling. Initial page load has local HTTP assets and a new browser context.
- Wait for the shared map to load, allow 2 seconds, then animate a 90-degree bearing change over 6 seconds. Record requestAnimationFrame interval mean/p95 and derived FPS, HUD quality and actual DPR. Record first map frame separately; it does not include later GLTF/deck/contour completion.
- Keep adaptive quality enabled. Report negative results and disabled effects, not just the best frame. Three GPU-memory usage and allocations inside third-party code are not measured here.
- Data sizes are raw checked-in bytes; library weights are gzip level9 of the exact vendored modules, excluding source maps. Report common and incremental modules separately.
- Tile SQL run already recorded 108 calls: 3×3 tile grid for z13–16 at Adler, central Sochi, Krasnaya Polyana. Krasnaya Polyana is outside the authorized bbox and its empty tiles must be excluded from meaningful size/latency summaries. HTTP benchmark uses the 72 in-bounds tiles against nginx/API, first request in that run, warm database/OS, no claim of cold filesystem cache.
- Visual matrix: all five × overview/street/balcony × 1440/375, reduced motion for stable screenshots. Additional center-Sochi controls/time and reduced-motion checks. This matrix proves rendering/controls, not GPU performance.
