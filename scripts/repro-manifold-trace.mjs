import { readFile } from "node:fs/promises"
import path from "node:path"

const tracePath = path.join(
  process.cwd(),
  ".next/server/pages/api/[...anyroute].js.nft.json",
)

const requiredFiles = [
  "node_modules/@tscircuit/copper-pour-solver/dist/index.js",
  "node_modules/manifold-3d/package.json",
  "node_modules/manifold-3d/lib/wasm.js",
  "node_modules/manifold-3d/manifold.js",
  "node_modules/manifold-3d/manifold.wasm",
]

const normalizeTracePath = (filePath) => filePath.replaceAll("\\", "/")

let trace
try {
  trace = JSON.parse(await readFile(tracePath, "utf8"))
} catch (error) {
  console.error(`Failed to read ${tracePath}`)
  console.error("Run `bun run build` first, then rerun this script.")
  throw error
}

const tracedFiles = trace.files.map(normalizeTracePath)
const hasTraceEntry = (expectedFile) =>
  tracedFiles.some((file) => file.endsWith(expectedFile))

for (const file of requiredFiles) {
  console.log(`${hasTraceEntry(file) ? "ok" : "missing"} ${file}`)
}

const manifoldFiles = tracedFiles.filter((file) =>
  file.includes("node_modules/manifold-3d/"),
)

console.log(`manifold-3d traced file count: ${manifoldFiles.length}`)

if (!hasTraceEntry("node_modules/@tscircuit/copper-pour-solver/dist/index.js")) {
  console.error("Repro did not load @tscircuit/copper-pour-solver in the trace.")
  process.exit(1)
}

if (!hasTraceEntry("node_modules/manifold-3d/package.json")) {
  console.error(
    "Repro confirmed: copper-pour-solver is traced, but manifold-3d is missing.",
  )
  process.exit(1)
}

console.log("Trace includes manifold-3d.")
