import { test, expect } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { getTestServer } from "./fixtures/get-test-server"

test("autoroutingphase addTestPoints generates probe pads", async () => {
  const { serverUrl } = await getTestServer()

  // Same example as docs.tscircuit.com's <autoroutingphase /> page
  const compressedCode = getCompressedBase64SnippetString(`
export default () => (
  <board width="20mm" height="14mm">
    <chip name="U1" footprint="soic8" pcbX={-4} />
    <resistor name="R1" resistance="10k" footprint="0603" pcbX={5} pcbY={3} />
    <resistor name="R2" resistance="10k" footprint="0603" pcbX={5} pcbY={-3} />
    <trace name="SDA" from="U1.pin1" to="R1.pin1" />
    <trace name="SCL" from="U1.pin8" to="R2.pin1" />

    <autoroutingphase
      reroute
      connections={["U1.pin1", "U1.pin8"]}
      addTestPoints
      testPointLayer="top"
      testPointMaxDetour="3mm"
    />
  </board>
)
  `)

  const response = await fetch(
    `${serverUrl}?code=${encodeURIComponent(compressedCode)}&format=circuit_json`,
  )

  expect(response.status).toBe(200)
  const circuitJson = await response.json()
  const testPoints = circuitJson.filter(
    (element: any) =>
      element.type === "source_component" &&
      element.name.startsWith("TP_AUTO_"),
  )
  expect(testPoints).toHaveLength(2)
})
