import { expect, test } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { getTestServer } from "./fixtures/get-test-server"

test("renders BiscuitBoard imports from the npm package", async () => {
  const { serverUrl } = await getTestServer()

  const response = await fetch(
    `${serverUrl}?svg_type=pcb&code=${encodeURIComponent(
      getCompressedBase64SnippetString(`
import { BiscuitBoard } from "biscuitboard"

export default () => (
  <BiscuitBoard>
    <resistor
      name="R1"
      resistance="1k"
      footprint="0603"
      pcbX={-8}
      pcbY={0}
    />
    <led
      name="LED1"
      footprint="0603"
      layer="bottom"
      pcbX={8}
      pcbY={0}
    />
    <trace from=".R1 > .pin2" to=".LED1 > .anode" />
  </BiscuitBoard>
)
      `),
    )}`,
  )
  const svgContent = await response.text()

  expect(response.status).toBe(200)
  expect(svgContent).not.toContain("Cannot find module")
  expect(svgContent).toMatchSvgSnapshot(import.meta.path)
})
