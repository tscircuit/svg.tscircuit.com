import { test, expect } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"

const testCircuitCode = `
export default () => (
  <board width="10mm" height="10mm">
    <resistor resistance="1k" footprint="0402" name="R1" schX={3} pcbX={3} />
    <capacitor capacitance="1000pF" footprint="0402" name="C1" schX={-3} pcbX={-3} />
    <trace from=".R1 > .pin1" to=".C1 > .pin1" />
  </board>
)
`

test("3d svg conversion with parameter variations", async () => {
  const { serverUrl } = await getTestServer()
  const encodedCode = encodeURIComponent(
    getCompressedBase64SnippetString(testCircuitCode),
  )

  // Test basic conversion (snapshot test)
  const basicResponse = await fetch(
    `${serverUrl}?svg_type=3d&code=${encodedCode}`,
  )
  const basicSvgContent = await basicResponse.text()
  expect(basicSvgContent).toMatchSvgSnapshot(import.meta.path)

  // Test custom background color
  const colorResponse = await fetch(
    `${serverUrl}?svg_type=3d&background_color=%23000000&background_opacity=1&code=${encodedCode}`,
  )
  const colorSvgContent = await colorResponse.text()
  expect(colorResponse.status).toBe(200)
  expect(colorSvgContent).toContain("<svg")
  expect(colorSvgContent).toMatchSvgSnapshot(import.meta.path, "3d-bg-color")

  // Test custom background opacity
  const opacityResponse = await fetch(
    `${serverUrl}?svg_type=3d&background_opacity=0.5&code=${encodedCode}`,
  )
  const opacitySvgContent = await opacityResponse.text()
  expect(opacityResponse.status).toBe(200)
  expect(opacitySvgContent).toContain("<svg")

  // Test custom zoom multiplier
  const zoomResponse = await fetch(
    `${serverUrl}?svg_type=3d&zoom_multiplier=2.0&code=${encodedCode}`,
  )
  const zoomSvgContent = await zoomResponse.text()
  expect(zoomResponse.status).toBe(200)
  expect(zoomSvgContent).toContain("<svg")
  expect(zoomSvgContent).toMatchSvgSnapshot(import.meta.path, "3d-zoom")

  // Test all custom parameters combined
  const allParamsResponse = await fetch(
    `${serverUrl}?svg_type=3d&background_color=%23ff0000&background_opacity=0.8&zoom_multiplier=1.5&code=${encodedCode}`,
  )
  const allParamsSvgContent = await allParamsResponse.text()
  expect(allParamsResponse.status).toBe(200)
  expect(allParamsSvgContent).toContain("<svg")
  expect(allParamsSvgContent).toMatchSvgSnapshot(
    import.meta.path,
    "3d-all-params",
  )

  // Test invalid parameter values fallback to defaults
  const invalidResponse = await fetch(
    `${serverUrl}?svg_type=3d&background_opacity=invalid&zoom_multiplier=notanumber&code=${encodedCode}`,
  )
  const invalidSvgContent = await invalidResponse.text()
  expect(invalidResponse.status).toBe(200)
  expect(invalidSvgContent).toContain("<svg")
})
