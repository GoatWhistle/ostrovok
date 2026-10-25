# Open-ended hotel search — 2026-10-26

User requests: arbitrary wishes, explicit-anywhere search, detailed catalog data, Polza Qwen3
Embedding 8B over all hotels in batches, then pull and restart the latest frontend. Credentials
stay in ignored .env and are never copied into evidence.

Reproduction: conversation 205e236b-1226-407e-bcb2-5ec0d3d805f4 retains «неважно в каком
городе, отель под водой», but returns null location and asks for a city twice. Saved response
assertion and use-case regression fail before the fix. Ranked hypotheses: city-only gate,
candidate selection before novel-wish discovery, literal filters without semantic retrieval.

Implementation contract:

- Distinguish explicit anywhere from omitted geography. Only the latter requires a place.
- Source-document retrieval behind a port; Qwen3 Embedding 8B via Polza, persisted vectors,
  resumable content-addressed batches. Lexical offline fallback. No model downloads in runtime.
- Similarity is candidate relevance, never proof. The exploration loop searches text, reads
  actual source quotes and measures real data to evaluate arbitrary wishes.
- Store complete provider records instead of discarding descriptions, room details and policies.
- No arbitrary zero-match hotel recommendations for an explicit broad search. State loaded
  coverage and insufficient evidence. Do not invent a Russian underwater hotel or its absence
  worldwide.

Initial data audit: 34,087 hotels; 15 with supplier content; 89 room categories. RU provider
listing responds with real Moscow data. Complete room coverage is a separate data problem.

Paid run authorized by the supplied Polza key and explicit batch request. /models confirms
qwen/qwen3-embedding-8b. /embeddings accepts input arrays and base64 float32 vectors. Batch
size 64, concurrency 8, default full 4096 dimensions. An optional 1024/base64 probe succeeded;
the catalog retains 4096. Transport switched from float to base64, preserving prior batches.

Verify: omitted/explicit place, nonliteral candidate retrieval, stale-vector rejection,
missing/corrupt index fallback, batch resumption/alignment, malformed/out-of-order API indices,
and similarity not proving underwater rooms. Run backend gates, frontend verify after type
regeneration, and original fresh/context replays on main :8080. Preserve failures as failures.

Live cases are fixed before execution in open-ended-20-cases.json: 20 messages, including
original fresh/context, explicit-anywhere vs omitted geography, impossible wishes, semantic
services/room variants, city and region regressions. Main :8080, two parallel requests.
Expectations distinguish geography and source-evidence checks from full recommendation accuracy.
