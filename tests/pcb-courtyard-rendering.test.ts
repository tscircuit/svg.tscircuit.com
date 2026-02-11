import { test, expect } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"

test("pcb courtyard rendering", async () => {
  const { serverUrl } = await getTestServer()

  const response = await fetch(
    `${serverUrl}?svg_type=pcb&show_courtyards=true&code=${encodeURIComponent(
      getCompressedBase64SnippetString(`
export default () => (
  <board width="30mm" height="30mm">
    <courtyardcircle radius={2} pcbX={-10} pcbY={-10} />
    <courtyardcircle radius={2} pcbX={10} pcbY={10} />
    {/* Triangle shape */}
    <courtyardoutline
      outline={[
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 1.5, y: 2.5 },
      ]}
    />
    {/* L-shaped polygon on bottom layer */}
    <courtyardoutline
      outline={[
        { x: 5, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 1 },
        { x: 6, y: 1 },
        { x: 6, y: 3 },
        { x: 5, y: 3 },
      ]}
      layer="bottom"
    />
    <courtyardrect width={2} height={3} pcbX={-10} pcbY={10} />
    <courtyardrect width={4} height={1} pcbX={10} pcbY={-10} layer="bottom" />
  </board>
)
    `),
    )}`,
  )
  const svgContent = await response.text()

  expect(svgContent).toMatchSvgSnapshot(import.meta.path)
})
