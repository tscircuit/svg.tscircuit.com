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
    "index.tsx": `export default () => (
  <board width="10mm" height="10mm">
    <resistor resistance="1k" footprint="0402" name="R1" />
  </board>
)
`,
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
  expect(html).toContain("Download Circuit JSON")

  const downloadLinkMatch = html.match(
    /href=\"([^\"]+)\"[^>]*>\s*Download Circuit JSON/,
  )

  expect(downloadLinkMatch).not.toBeNull()

  const downloadHref = downloadLinkMatch![1].replace(/&amp;/g, "&")
  const downloadUrl = new URL(downloadHref, serverUrl)
  const circuitJsonResponse = await fetch(downloadUrl)

  if (circuitJsonResponse.status !== 200) {
    const errorBody = await circuitJsonResponse.text()
    throw new Error(
      `circuit_json download failed: ${circuitJsonResponse.status} ${errorBody}`,
    )
  }

  expect(circuitJsonResponse.headers.get("content-type")).toBe(
    "application/json",
  )
  expect(
    circuitJsonResponse.headers.get("content-disposition") ?? "",
  ).toContain("circuit.json")

  const circuitJson = await circuitJsonResponse.json()
  expect(Array.isArray(circuitJson)).toBe(true)
  expect(circuitJson.length).toBeGreaterThan(0)
})
