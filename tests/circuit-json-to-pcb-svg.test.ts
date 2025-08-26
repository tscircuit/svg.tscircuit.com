import { test, expect } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"
import testCircuitJson from "./fixtures/test-circuit.json"

test("circuit_json to pcb svg conversion and error handling", async () => {
  const { serverUrl } = await getTestServer()

  // Test 1: Valid circuit JSON
  const encodedJson = Buffer.from(JSON.stringify(testCircuitJson)).toString(
    "base64",
  )

  const validResponse = await fetch(
    `${serverUrl}?svg_type=pcb&circuit_json=${encodeURIComponent(encodedJson)}`,
  )
  const svgContent = await validResponse.text()
  expect(svgContent).toMatchSvgSnapshot(import.meta.path)

  // Test 2: Invalid base64 circuit JSON
  const invalidResponse = await fetch(
    `${serverUrl}?svg_type=pcb&circuit_json=invalid_base64!@#`,
  )
  expect(invalidResponse.headers.get("content-type")).toBe("image/svg+xml")
  const errorSvg = await invalidResponse.text()
  expect(errorSvg).toContain("<svg")
  expect(errorSvg).toContain("error")

  // Test 3: Valid base64 but invalid JSON
  const invalidJsonBase64 = Buffer.from("{invalid json").toString("base64")
  const invalidJsonResponse = await fetch(
    `${serverUrl}?svg_type=pcb&circuit_json=${encodeURIComponent(invalidJsonBase64)}`,
  )
  expect(invalidJsonResponse.headers.get("content-type")).toBe("image/svg+xml")
  const jsonErrorSvg = await invalidJsonResponse.text()
  expect(jsonErrorSvg).toContain("<svg")
  expect(jsonErrorSvg).toContain("error")

  // Test 4: Missing parameters (with a non-root path to bypass index page logic)
  const noParamsResponse = await fetch(`${serverUrl}/svg?svg_type=pcb`)
  expect(noParamsResponse.status).toBe(400)
  const noParamsError = await noParamsResponse.json()
  expect(noParamsError.ok).toBe(false)
  expect(noParamsError.error).toContain(
    "No code or circuit_json parameter provided",
  )

  // Test 5: Invalid svg_type
  const invalidTypeResponse = await fetch(
    `${serverUrl}?svg_type=invalid&circuit_json=${encodeURIComponent(encodedJson)}`,
  )
  expect(invalidTypeResponse.status).toBe(400)
  const invalidTypeError = await invalidTypeResponse.json()
  expect(invalidTypeError.ok).toBe(false)
  expect(invalidTypeError.error).toContain("Invalid svg_type")
})
