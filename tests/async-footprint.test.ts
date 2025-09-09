import { test, expect } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"

test("async footprint conversion", async () => {
  const { serverUrl } = await getTestServer()

  const response = await fetch(
    `${serverUrl}?svg_type=pcb&code=${encodeURIComponent(
      getCompressedBase64SnippetString(`
export default () => (
<board width="10mm" height="10mm">
  <resistor
    name="R1"
    resistance="10k"
    footprint="kicad:Resistor_SMD/R_0402_1005Metric"
    pcbX={0}
  />
</board>
)
    `),
    )}`,
  )
  const svgContent = await response.text()

  expect(svgContent).toMatchSvgSnapshot(import.meta.path)
})
