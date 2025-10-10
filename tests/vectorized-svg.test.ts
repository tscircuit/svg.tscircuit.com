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

test("vectorized svg conversion", async () => {
  const { serverUrl } = await getTestServer()
  const encodedCode = encodeURIComponent(
    getCompressedBase64SnippetString(testCircuitCode),
  )

  const response = await fetch(
    `${serverUrl}?svg_type=3d&browser3d=true&code=${encodedCode}`,
  )
  const svgContent = await response.text()

  expect(response.status).toBe(200)
  expect(svgContent).toContain("<svg")
}, 30000)
