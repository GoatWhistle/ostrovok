import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { viteSingleFile } from "vite-plugin-singlefile"

const root = fileURLToPath(new URL("./src", import.meta.url))
const repo = fileURLToPath(new URL("..", import.meta.url))

export default defineConfig({
  root,
  base: "./",
  plugins: [react(), viteSingleFile()],
  server: { port: 4180, fs: { allow: [repo] } },
  build: { outDir: "../dist", emptyOutDir: true, assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 20_000 },
})
