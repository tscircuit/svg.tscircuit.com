import { test, expect } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"
import testCircuitJson from "./fixtures/test-circuit.json"

test("circuit_json to pcb svg conversion", async () => {
  const { serverUrl } = await getTestServer()

  const encodedJson = Buffer.from(JSON.stringify(testCircuitJson)).toString(
    "base64",
  )

  const response = await fetch(
    `${serverUrl}?svg_type=pcb&circuit_json=${encodeURIComponent(encodedJson)}`,
  )
  const svgContent = await response.text()

  expect(svgContent).toMatchSvgSnapshot(import.meta.path)
})