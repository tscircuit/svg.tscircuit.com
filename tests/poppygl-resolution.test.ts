import { expect, test } from "bun:test"
import { createRequire } from "node:module"
import packageJson from "../package.json"

test("3D rendering resolves the same poppygl release as tscircuit", () => {
  // A current top-level package can hide an older renderer-local copy.
  const rendererRequire = createRequire(
    import.meta.resolve("circuit-json-to-3d-png"),
  )
  const tscircuitRequire = createRequire(import.meta.resolve("tscircuit"))
  const rendererVersion = rendererRequire("poppygl/package.json").version

  expect(rendererVersion).toBe(packageJson.dependencies.poppygl)
  expect(rendererVersion).toBe(packageJson.overrides.poppygl)
  expect(rendererVersion).toBe(tscircuitRequire("poppygl/package.json").version)
})
