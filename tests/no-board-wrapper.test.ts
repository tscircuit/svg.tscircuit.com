import { test, expect } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"

test("circuit without board wrapper should render correctly", async () => {
  const { serverUrl } = await getTestServer()

  const response = await fetch(
    `${serverUrl}?svg_type=schematic&code=${encodeURIComponent(
      getCompressedBase64SnippetString(`
export default () => (
  <>
    <resistor
      resistance="1k"
      footprint="0402"
      name="R1"
      schX={3}
      pcbX={3}
    />
    <capacitor
      capacitance="1000pF"
      footprint="0402"
      name="C1"
      schX={-3}
      pcbX={-3}
    />
    <trace from=".R1 > .pin1" to=".C1 > .pin1" />
  </>
)
    `),
    )}`,
  )
  const svgContent = await response.text()

  expect(svgContent).toMatchSvgSnapshot(import.meta.path)
})