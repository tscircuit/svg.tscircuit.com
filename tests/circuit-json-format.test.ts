import { test, expect } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { getTestServer } from "./fixtures/get-test-server"

test("format=circuit_json returns circuit json payload", async () => {
  const { serverUrl } = await getTestServer()

  const compressedCode = getCompressedBase64SnippetString(`
export default () => (
  <board width="10mm" height="10mm">
    <resistor resistance="1k" footprint="0402" name="R1" />
  </board>
)
  `)

  const response = await fetch(
    `${serverUrl}?code=${encodeURIComponent(compressedCode)}&format=circuit_json`,
  )

  expect(response.status).toBe(200)
  expect(response.headers.get("content-type")).toContain("application/json")

  const circuitJson = await response.json()

  expect(Array.isArray(circuitJson)).toBe(true)
  expect(circuitJson.length).toBeGreaterThan(0)
})
