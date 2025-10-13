import { test, expect } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import testCircuitJson from "./fixtures/test-circuit.json"

const testCircuitCode = `
export default () => (
  <board width="10mm" height="10mm">
    <chip footprint="soic8" name="U1"/>
  </board>
)
`

test(
  "3d svg conversion with parameter variations",
  async () => {
    const { serverUrl } = await getTestServer()
    const encodedCode = encodeURIComponent(
      getCompressedBase64SnippetString(testCircuitCode),
    )

    // Test basic conversion (snapshot test)
    const response = await fetch(`${serverUrl}?svg_type=3d&code=${encodedCode}`)
    const svgContent = await response.text()
    expect(svgContent).toMatch3dSvgSnapshot(import.meta.path)
  },
  { timeout: 30000 },
)
