import { expect, test } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { getTestServer } from "./fixtures/get-test-server"

const antennaSnippet = getCompressedBase64SnippetString(`
export default () => (
  <board width="30mm" height="14mm">
    <antenna
      name="ANT1"
      antennaShape="2.4ghz_meandered_monopole"
      frequencyBand="2.4ghz"
      pcbX={-6}
    />
  </board>
)
`)

test("renders a generated antenna in a PCB SVG", async () => {
  const { serverUrl } = await getTestServer()

  const response = await fetch(
    `${serverUrl}?svg_type=pcb&code=${encodeURIComponent(antennaSnippet)}`,
  )
  const svgContent = await response.text()

  expect(response.status).toBe(200)
  expect(svgContent).toContain('data-type="pcb_trace"')
  expect(svgContent).toMatchSvgSnapshot(import.meta.path)
})
