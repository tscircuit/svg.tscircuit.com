import { test, expect } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { getTestServer } from "./fixtures/get-test-server"

test("debug page renders request information", async () => {
  const { serverUrl } = await getTestServer()

  const compressedCode = getCompressedBase64SnippetString(`
export default () => (
  <board width="10mm" height="10mm">
    <resistor resistance="1k" footprint="0402" name="R1" />
  </board>
)
  `)

  const fsMap = {
    "index.tsx":
      "export const Example = () => {\n  return <div>Hello</div>\n}\n",
  }

  const response = await fetch(
    `${serverUrl}?svg_type=pcb&code=${encodeURIComponent(
      compressedCode,
    )}&fs_map=${encodeURIComponent(JSON.stringify(fsMap))}&debug=1`,
  )

  expect(response.status).toBe(200)
  expect(response.headers.get("content-type")).toBe("text/html")

  const html = await response.text()
  expect(html).toContain("Request Debug Information")
  expect(html).toContain("debug")
  expect(html).toContain("Decompressed Code")
  expect(html).toContain("export default () =&gt; (")
  expect(html).toContain("Decoded fs_map")
  expect(html).toContain("index.tsx")
  expect(html).toContain("newline-symbol")
})
