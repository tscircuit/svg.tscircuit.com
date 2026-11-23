import { expect, test } from "bun:test"
import { createRequire } from "node:module"

test("3D and drawing renderers share the same poppygl installation", () => {
  // A current top-level package can hide an older renderer-local copy.
  const rendererRequire = createRequire(
    import.meta.resolve("circuit-json-to-3d-png"),
  )
  const drawingRequire = createRequire(
    import.meta.resolve("@tscircuit/circuit-json-to-drawing"),
  )
  const tscircuitRequire = createRequire(import.meta.resolve("tscircuit"))
  const rendererVersion = rendererRequire("poppygl/package.json").version

  expect(rendererVersion).toBe(
    createRequire(import.meta.url)("poppygl/package.json").version,
  )
  expect(rendererRequire.resolve("poppygl")).toBe(
    createRequire(import.meta.url).resolve("poppygl"),
  )
  expect(drawingRequire.resolve("poppygl")).toBe(
    rendererRequire.resolve("poppygl"),
  )
  expect(rendererVersion).toBe(tscircuitRequire("poppygl/package.json").version)
})
