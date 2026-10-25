# Dagestan region search regression — 2026-10-26

User symptom: conversation 29180a98-3251-4367-ae43-107698605da3 asks for a city twice,
even after the user explicitly accepts any city in Dagestan. Saved effective query retains
the region; parsed location is null. The parse prompt requires a city and the search only
resolves city extents. The saved response assertion and new use-case test both failed before
the fix. The test expects region candidates within a polygon, with no city lookup.

Live checks on the main stand :8080, manually authorized paid provider verification:

1. Fresh chat: «хочу отель высоко в горах в дагестане».
2. Existing user chat: «просто в принципе в любом в горах главное и в Дагестане».

Acceptance: HTTP 200, region retained, no city clarification, nonempty results, every returned
hotel lies within the loaded Dagestan polygon. The first result must have a derived match
grounded in terrain measurements. Check altitude and local relief separately in the saved
explanation. No claim that room availability or views are confirmed.

Each response and duration are saved separately. Provider failures and semantic failures
remain in the report. No requests outside these two cases are needed unless a failure
requires another replay. Full 50-query rerun is outside this regression check.
