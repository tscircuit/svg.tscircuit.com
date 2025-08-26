import { test, expect } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"

test("code parameter works with both GET and POST methods", async () => {
  const { serverUrl } = await getTestServer()

  const compressedCode = getCompressedBase64SnippetString(`
export default () => (
  <board width="10mm" height="10mm">
    <resistor
      resistance="1k"
      footprint="0402"
      name="R1"
      schX={3}
      pcbX={3}
    />
  </board>
)
  `)

  // Test 1: GET request with code parameter
  const getResponse = await fetch(
    `${serverUrl}?svg_type=pcb&code=${encodeURIComponent(compressedCode)}`,
  )
  expect(getResponse.headers.get("content-type")).toBe("image/svg+xml")
  const getSvgContent = await getResponse.text()
  expect(getSvgContent).toContain("<svg")

  // Test 2: POST request with code parameter in query string
  const postResponse = await fetch(
    `${serverUrl}?svg_type=pcb&code=${encodeURIComponent(compressedCode)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  )
  expect(postResponse.headers.get("content-type")).toBe("image/svg+xml")
  const postSvgContent = await postResponse.text()
  expect(postSvgContent).toContain("<svg")
})
