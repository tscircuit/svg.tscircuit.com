import { test, expect } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"

test("POST /generate_urls returns HTML without re-reading the body", async () => {
  const { serverUrl } = await getTestServer()

  const response = await fetch(`${serverUrl}/generate_urls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fs_map: {
        "index.tsx": `export default () => (
  <board width="10mm" height="10mm">
    <resistor resistance="1k" footprint="0402" name="R1" schX={3} pcbX={3} />
  </board>
)`,
      },
      entrypoint: "index.tsx",
    }),
  })

  expect(response.status).toBe(200)
  expect(response.headers.get("content-type")).toContain("text/html")
  const html = await response.text()
  expect(html).toContain("svg.tscircuit.com - Generated URLs")
})
