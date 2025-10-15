import { test, expect } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"

test("Pill-shaped hole should render correctly in 3D SVG", async () => {
  const { serverUrl } = await getTestServer()

  const encoded = encodeURIComponent(
    getCompressedBase64SnippetString(`
export default () => (
  <board width="20mm" height="20mm">
    <hole
      shape="pill"
      x={0}
      y={0}
      width="2mm"
      height="4mm"
      pcbRotation={45}
    />
  </board>
)
    `),
  )

  const response = await fetch(`${serverUrl}?svg_type=3d&code=${encoded}`)
  const svgContent = await response.text()

  expect(response.status).toBe(200)
  expect(svgContent).toContain("<svg")
  // 3D pipeline should cut the board; ensure SVG contains board texture/image
  expect(svgContent).toMatch3dSvgSnapshot(import.meta.path)
})
