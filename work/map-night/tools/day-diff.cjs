const fs = require("node:fs")
const [beforeFile, afterFile] = process.argv.slice(2)
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"))
const before = read(beforeFile)
const after = read(afterFile)
const layers = (snapshot) => new Map(snapshot.style.layers.map((layer) => [layer.id, layer]))
const was = layers(before)
const now = layers(after)
const changed = []
for (const [id, layer] of now) {
  const old = was.get(id)
  if (!old) {
    changed.push({ id, change: "added" })
    continue
  }
  for (const key of new Set([...Object.keys(old.paint ?? {}), ...Object.keys(layer.paint ?? {})])) {
    const a = JSON.stringify(old.paint?.[key])
    const b = JSON.stringify(layer.paint?.[key])
    if (a !== b) changed.push({ id, key, before: old.paint?.[key], after: layer.paint?.[key] })
  }
  if (old.visibility !== layer.visibility) changed.push({ id, key: "visibility", before: old.visibility, after: layer.visibility })
}
for (const id of was.keys()) if (!now.has(id)) changed.push({ id, change: "removed" })
const mesh = (name) => JSON.stringify(before[name]) === JSON.stringify(after[name]) ? "same" : { before: before[name], after: after[name] }
const light = JSON.stringify(before.style.light) === JSON.stringify(after.style.light) ? "same" : { before: before.style.light, after: after.style.light }
console.log(JSON.stringify({ layers: now.size, changed, light, roofs: mesh("roofs"), trees: mesh("trees") }, null, 2))
