import asyncio, json, os, sys
from pathlib import Path
import numpy as np
from hotel_agent.adapters.semantic.polza import PolzaEmbeddings

KNOWN = {
    "r8344680": "Отель Skypoint Gamma Delta Alfa",
    "n4837009258": "Отель Centeral Hotel",
    "w118064725": "Отель Союз",
    "n10293557509": "Отель 45 Параллель",
    "n10655478329": "Апартаменты iRent",
    "w115555771": "Lis Mini Hotel",
    "n4227939528": "Август",
}

def env(path):
    for line in Path(path).read_text().splitlines():
        if line.startswith("EMBEDDING_API_KEY="):
            return line.split("=", 1)[1].strip()
    raise SystemExit("no key")

async def main():
    locals_rows = {}
    for line in Path(sys.argv[1]).read_text().splitlines():
        hid, name, addr, city, lon, lat = line.split("|")
        locals_rows[hid] = {"name": name, "addr": addr, "city": city}
    suggest = {r["id"]: r for r in json.loads(Path(sys.argv[2]).read_text())}

    texts, index = [], {}
    def add(text):
        if text not in index:
            index[text] = len(texts)
            texts.append(text)
        return index[text]

    jobs = []
    for hid, row in locals_rows.items():
        cands = (suggest.get(hid) or {}).get("ru") or []
        if not cands:
            continue
        local_text = ", ".join(part for part in (row["name"], row["addr"], row["city"]) if part)
        job = {"id": hid, "local": local_text, "local_i": add(local_text), "cands": []}
        for cand in cands:
            text = ", ".join(part for part in (cand["name"], cand["addr"] or "", cand["region"] or "") if part)
            job["cands"].append({"name": cand["name"], "text": text, "i": add(text)})
        jobs.append(job)

    embedder = PolzaEmbeddings(env(sys.argv[3]))
    vectors = np.array(await embedder.embed(texts), dtype=np.float32)
    vectors /= np.linalg.norm(vectors, axis=1, keepdims=True)
    await embedder._client.aclose()

    out = []
    for job in jobs:
        local = vectors[job["local_i"]]
        scored = sorted(((float(local @ vectors[c["i"]]), c["name"]) for c in job["cands"]), reverse=True)
        known = KNOWN.get(job["id"])
        rank = next((i + 1 for i, (_, name) in enumerate(scored) if name == known), None) if known else None
        out.append({"id": job["id"], "local": job["local"], "known": known,
                    "known_rank": rank, "scored": [[round(s, 3), n] for s, n in scored]})
        print(json.dumps(out[-1], ensure_ascii=False))
    Path(sys.argv[4]).write_text(json.dumps(out, ensure_ascii=False, indent=2))
    hits = [r for r in out if r["known_rank"] == 1]
    print(f"\nknown cases: {sum(1 for r in out if r['known'])}, top1 correct: {len(hits)}")
    print("correct-case top1 scores:", sorted(r["scored"][0][0] for r in out if r["known"]))
    print("no-known-case top1 scores:", sorted(r["scored"][0][0] for r in out if not r["known"]))

asyncio.run(main())
