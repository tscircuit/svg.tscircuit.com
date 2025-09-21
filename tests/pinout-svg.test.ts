import { expect, test } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"
import pinoutCircuitJson from "./fixtures/pinout-circuit.json"

test("circuit_json to pinout svg conversion", async () => {
  const { serverUrl } = await getTestServer()

  const response = await fetch(`${serverUrl}?svg_type=pinout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ circuit_json: pinoutCircuitJson }),
  })

  expect(response.status).toBe(200)

  const svgContent = await response.text()
  expect(svgContent).toMatchSvgSnapshot(import.meta.path)
})
