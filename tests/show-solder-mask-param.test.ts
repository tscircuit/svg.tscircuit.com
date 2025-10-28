import { expect, test } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { getTestServer } from "./fixtures/get-test-server"
import { getRequestContext } from "../lib/getRequestContext"

test("showSolderMask=true sets showSolderMask flag", async () => {
  const request = new Request("https://example.com?showSolderMask=true")
  const ctxOrResponse = await getRequestContext(request)
  if (ctxOrResponse instanceof Response) {
    throw new Error("Expected request context, received Response")
  }

  expect(ctxOrResponse.showSolderMask).toBe(true)
})

test("showSolderMask=0 sets showSolderMask flag to false", async () => {
  const request = new Request("https://example.com?showSolderMask=0")
  const ctxOrResponse = await getRequestContext(request)
  if (ctxOrResponse instanceof Response) {
    throw new Error("Expected request context, received Response")
  }

  expect(ctxOrResponse.showSolderMask).toBe(false)
})

test("showSolderMask=true renders pads with solder mask color", async () => {
  const { serverUrl } = await getTestServer()
  const encodedSnippet = encodeURIComponent(
    getCompressedBase64SnippetString(`
export default () => (
   <board width="20mm" height="20mm">
      <chip name="U1" footprint={
          <footprint>
        <smtpad shape="polygon" layer="top" portHints={["pin1"]} points={[
          { x: -4.5, y: 2 },
          { x: -2.2, y: 2 },
          { x: -0.4, y: 0 },
          { x: -2.2, y: -2 },
          { x: -4.5, y: -2 },
        ]} />
        <smtpad shape="polygon" layer="top" portHints={["pin2"]} points={[
          { x: -1.8, y: 2 },
          { x: 1.8, y: 2 },
          { x: 3.6, y: 0 },
          { x: 1.8, y: -2 },
          { x: -1.8, y: -2 },
          { x: 0, y: 0 },
        ]} />
        <smtpad shape="polygon" layer="top" portHints={["pin3"]} points={[
          { x: 2.2, y: 2 },
          { x: 6, y: 2 },
          { x: 6, y: -2 },
          { x: 2.2, y: -2 },
          { x: 4, y: 0 },
        ]} />
      </footprint>
      } />
    </board>
)
`),
  )

  const response = await fetch(
    `${serverUrl}?svg_type=pcb&show_solder_mask=true&code=${encodedSnippet}`,
  )
  const svgContent = await response.text()

  expect(svgContent).toMatchSvgSnapshot(import.meta.path)
}, 10000)
