# Place details and nearby walks

The left detail panel opens from an OSM place button. The parent page composes the map and place feature; the map reports its selected date and hour. The existing scroll region receives focus and the back action restores the hotel details. On mobile, opening a place activates the hotel/detail tab; showing its route activates the map tab.

The panel shows the place name and category, walk information, opening hours and available address/contact fields. Each present field carries OSM source, snapshot date, confidence and status. Missing name, address, hours and route are explicit. Unsupported opening-hours expressions keep their original text; no guessed open/closed state appears. Common weekly expressions use the selected Moscow local time, including intervals crossing midnight. Links permit only http/https.

One button represents a place and its route endpoint, avoiding duplicate markers at identical coordinates. Route labels show minutes for graph paths and straight-line meters for fallback paths. The first two are persistent; other labels appear on hover or keyboard focus and still pass collision layout. All paths use the existing draw animation; reduced motion skips drawing. Straight fallback lines are dashed.

Acceptance: real Abris two-bar and AIDA five-bar scenarios; 375/1440, RU/EN, both themes. Edge cases use intercepted test-only responses: nameless bar, missing hours, long name and unsupported hours. No test data enters product source or storage.
