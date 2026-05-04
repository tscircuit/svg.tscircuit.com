import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { expect, test } from "bun:test"

const tracePath = path.join(
  process.cwd(),
  ".next/server/pages/api/[...anyroute].js.nft.json",
)

const traceTest = existsSync(tracePath) ? test : test.skip

const requiredTraceFiles = [
  "node_modules/@tscircuit/copper-pour-solver/dist/index.js",
  "node_modules/manifold-3d/package.json",
  "node_modules/manifold-3d/lib/wasm.js",
  "node_modules/manifold-3d/manifold.js",
  "node_modules/manifold-3d/manifold.wasm",
]

const normalizeTracePath = (filePath: string) => filePath.replaceAll("\\", "/")

traceTest(
  "Next API trace includes manifold-3d for copper-pour-solver",
  async () => {
    const trace = JSON.parse(await readFile(tracePath, "utf8")) as {
      files: string[]
    }

    const tracedFiles = trace.files.map(normalizeTracePath)
    const missingFiles = requiredTraceFiles.filter(
      (requiredFile) =>
        !tracedFiles.some((file) => file.endsWith(requiredFile)),
    )

    expect(missingFiles).toEqual([])
    expect(
      tracedFiles.filter((file) => file.includes("node_modules/manifold-3d/"))
        .length,
    ).toBeGreaterThan(0)
  },
)
