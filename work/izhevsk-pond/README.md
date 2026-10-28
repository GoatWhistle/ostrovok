# Izhevsk pond diagnosis, 2026-10-26

Exact request: «отель в ижевске с видом на пруд».

The stored failed conversation is in `before.json`. City resolved, no results,
20 agent actions followed by timeout. `probe.py` reproduces the causal seam:
`by_name("пруд", natural=water)` returns None; `by_name("Ижевский пруд")`
returns r17062660. Its real OSM multipolygon loads successfully. Agent fallback
`measure_geometry` supports coastlines only, so it cannot repair this target name.

The prompt now resolves a known natural object from city context to its full name;
this remains a search hypothesis checked against typed real OSM data and sightlines.
Unknown/ambiguous targets require clarification. No city-to-hotel lookup was added.
`parsed-after.json` records the live Yandex DeepSeek parse. `native.json` records
61 hotel checks: 4 visible, 13 blocked, 44 unknown. Missing floors remain unknown.

`after.json` is the exact HTTP chat request through the isolated image on port8002:
4 results, native check one tool call, recommendation review accepted all4.
Panorama, ГК Заячья усадьба, Лосиный остров, Эко Порт. This proves modeled facade
visibility, not a bookable room. Answer reviewer used its safe factual fallback.
`python3 work/izhevsk-pond/check.py work/izhevsk-pond/before.json` fails;
the same command with `after.json` passes and checks geometric evidence.

103 focused unit tests passed; Ruff and formatting passed. The first test command
contained a nonexistent spatial-resolution test filename and ran no tests; corrected.
First staging curl reached startup and got empty reply; repeated when healthy passed.

Patch source: /Users/savelij/projects/o-hack-pond, fix/izhevsk-pond, base f20c259.
Only prompts.py is layered over exact current image5ebea97d, preserving all other
runtime modules. Image hotel-agent-backend:pond-20261026, container
hotel-agent-pond-check, port8002. Root and owner stand prompt files also have the
same additive patch without overwriting concurrent component changes.
Main backend remains window-integrated-20261026d. Awaiting user decision on switching
because owner SESSION explicitly forbids restart during their active50-query run.
No commits/push yet. Old recorded user chat was not rewritten.

## Authorized deployment and Claude attempt

User: «да и запусти на клоде». Backend switched to image
`pond-claude-20261026` (same verified pond source); frontend image left running.
Claude Sonnet4.6 configured against api.anthropic.com using saved ANTHROPIC_API_KEY.
Live parsing failed HTTP401; direct minimal API probe also returned
`authentication_error: invalid x-api-key`. Key is nonempty, unquoted, no surrounding
whitespace, and matches saved credential. No secrets logged. Chat swallowed provider
failure into generic clarification; claude-after.json is failed smoke evidence.

Reverted provider to Yandex DeepSeek to preserve service availability, retaining
pond fix and saved Anthropic credential. Claude activation requires valid key or
correct issuer endpoint. Main image tag includes claude for the attempted deployment,
but active provider is DeepSeek. User authorized interrupting owner's50-query run;
any overlapping results require runtime/provider audit.

Final main :8080 smoke: main-after.json,4 hotels with actual pond geometric evidence; checker PASS. Health200, DeepSeek/free confirmed. Temporary port8002 container removed.

User-requested key recheck: local .env credential equals running container; direct Anthropic messages request with version2023-06-01 returns401 invalid x-api-key (request req_011CgRAzYRvmhm8AP1nzUdxw); application adapter independently returns401. No configuration changes.
