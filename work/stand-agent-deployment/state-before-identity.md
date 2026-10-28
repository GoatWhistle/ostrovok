## Current state

- Latest deployment: user authorized restart and Claude. Main backend now `pond-claude-20261026` with verified pond fix. Saved Anthropic key rejected HTTP401 invalid x-api-key; reverted provider to Yandex DeepSeek to keep service working. Need valid Anthropic key/issuer endpoint to activate Claude. Supersedes earlier runtime/pending-deployment notes. Concurrent50-query run was interrupted by authorized restart; audit overlapping results. [Evidence](../work/izhevsk-pond/README.md).

- Izhevsk pond bug: generic target «пруд» did not resolve; contextual full-name prompt fix verified through real DeepSeek/chat on isolated :8002,4 results with geometric evidence,103 unit tests passed. Root and stand source prompt patched additively. Image `hotel-agent-backend:pond-20261026`; main unchanged while owner50-query run active. User asked whether to interrupt it for deployment. [Diagnosis](../work/izhevsk-pond/README.md).

- Root `feat/hotel-agent-mvp`/`8e229bc` remains dirty and preserved. Main :8080 image is `window-integrated-20261026d`, owner source `/Users/savelij/projects/o-hack-stand`/`f20c259`; current agent/reviewer and geography hashes verified. DeepSeek Yandex/free data retained.
- Russia data task complete:27,488,779 building/part contours,17,847 beach polygons, all34,087 hotel tags refreshed. Source-wide audit found594 unassembled objects; all located and excluded from full coverage. [Results and limits](../work/geography/verification.md), [product evidence](../docs/evidence.md#подробная-география-россии-2026-10-26).
- Geography compatibility patch committed locally as `8a69b8a` on `fix/russia-geography-stand` in `/Users/savelij/projects/o-hack-geography-stand`;665 backend checks passed. Current owner integrated image includes the same geography.14 city scenes and five terrain tiles verified after integration. No model or paid indexing calls in this data task.

## Next actions and pitfalls

- Keep current integrated image. Do not overwrite shared pinned tags with root-source builds. An accidental root-image replacement was corrected; overlapping quality evaluations need source/image/data audit. [Correction](../work/geography/deployment-correction.json), [current hashes](../work/geography/deployment-verification.json).
- Window-view50-query goal remains active/incomplete; parallel rounds3/4 belong to the stand owner. Do not claim their results for this data task or start concurrent paid batches. [Complete previous session](../work/geography/session-before-final.md) preserves prior run IDs and instructions.
- Overpass live probes failed; online geography hydration is not verified. Local coverage works; unknown source fields remain unknown. New hotel text invalidates old vector hashes; no paid reindex without manual request.
- Preserve root consultation/provider/frontend edits and all exact instructions. Protected SESSION instructions exceed target; retain verbatim.
