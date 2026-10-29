import { copyFileSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"

const source = fileURLToPath(new URL("../dist/index.html", import.meta.url))
const target = fileURLToPath(new URL("../index.html", import.meta.url))
copyFileSync(source, target)
console.log(`index.html ${(statSync(target).size / 1024 / 1024).toFixed(1)} MB`)
