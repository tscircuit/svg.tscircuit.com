import { expect, test } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"

test("fs_map supports tscircuit.config.ts imports for the TI parts engine", async () => {
  const { serverUrl } = await getTestServer()

  const fsMap = {
    "package.json": JSON.stringify({
      dependencies: {
        "@tscircuit/ti-parts-engine": "github:tscircuit/ti-parts-engine",
      },
    }),
    "tscircuit.config.ts": `
import { createTiPlatformConfig } from "@tscircuit/ti-parts-engine"

export default {
  platformConfig: createTiPlatformConfig(),
}
`,
    "index.circuit.tsx": `export default () => (
  <board width="10mm" height="10mm">
    <chip name="U1" footprint="ti:LM358" />
  </board>
)`,
  }

  const response = await fetch(`${serverUrl}?svg_type=pcb`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fs_map: fsMap,
      main_component_path: "index.circuit.tsx",
    }),
  })

  expect(response.headers.get("content-type")).toBe("image/svg+xml")
  const svgContent = await response.text()
  expect(svgContent).toMatchSvgSnapshot(import.meta.path)
}, 300000)
