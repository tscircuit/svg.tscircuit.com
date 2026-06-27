import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { expect, test } from "bun:test"

const tracePath = path.join(
  process.cwd(),
  ".next/server/pages/api/[...anyroute].js.nft.json",
)

const traceTest = existsSync(tracePath) ? test : test.skip

const normalizeTracePath = (filePath: string) => filePath.replaceAll("\\", "/")

// The ngspice spice engine dynamically imports @tscircuit/eecircuit-engine. If
// the engine is not traced into the serverless function, the runtime import
// fails and the engine falls back to loading it from a CDN via a `blob:` URL,
// which Node's ESM loader rejects. Ensure the engine (which embeds its wasm in
// the .mjs bundle) is included in the Next API trace.
traceTest(
  "Next API trace includes @tscircuit/eecircuit-engine for ngspice simulation",
  async () => {
    const trace = JSON.parse(await readFile(tracePath, "utf8")) as {
      files: string[]
    }

    const tracedFiles = trace.files.map(normalizeTracePath)
    const includesEngine = tracedFiles.some((file) =>
      file.includes("node_modules/@tscircuit/eecircuit-engine/"),
    )

    expect(includesEngine).toBe(true)
  },
)
