import { test, expect } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"
import testCircuitJson from "./fixtures/test-circuit.json"

test("circuit_json to pcb svg conversion and error handling", async () => {
  const { serverUrl } = await getTestServer()

  // Test 1: Valid circuit JSON via POST
  const validResponse = await fetch(`${serverUrl}?svg_type=pcb`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ circuit_json: testCircuitJson }),
  })
  const svgContent = await validResponse.text()
  expect(svgContent).toMatchSvgSnapshot(import.meta.path)

  // Test 2: Invalid JSON in POST body
  const invalidJsonResponse = await fetch(`${serverUrl}?svg_type=pcb`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "invalid json",
  })
  expect(invalidJsonResponse.status).toBe(400)
  const invalidJsonError = await invalidJsonResponse.json()
  expect(invalidJsonError.ok).toBe(false)
  expect(invalidJsonError.error).toContain("Invalid JSON in request body")

  // Test 3: Missing parameters (with a non-root path to bypass index page logic)
  const noParamsResponse = await fetch(`${serverUrl}/svg?svg_type=pcb`)
  expect(noParamsResponse.status).toBe(400)
  const noParamsError = await noParamsResponse.json()
  expect(noParamsError.ok).toBe(false)
  expect(noParamsError.error).toContain(
    "No code parameter (GET/POST), circuit_json (POST), or fs_map (GET/POST) provided",
  )

  // Test 4: Invalid svg_type with POST circuit_json
  const invalidTypeResponse = await fetch(`${serverUrl}?svg_type=invalid`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ circuit_json: testCircuitJson }),
  })
  expect(invalidTypeResponse.status).toBe(400)
  const invalidTypeError = await invalidTypeResponse.json()
  expect(invalidTypeError.ok).toBe(false)
  expect(invalidTypeError.error).toContain("Invalid svg_type")

  // Test 5: POST without circuit_json in body
  const noCircuitJsonResponse = await fetch(`${serverUrl}?svg_type=pcb`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ other_param: "value" }),
  })
  expect(noCircuitJsonResponse.status).toBe(400)
  const noCircuitJsonError = await noCircuitJsonResponse.json()
  expect(noCircuitJsonError.ok).toBe(false)
  expect(noCircuitJsonError.error).toContain(
    "No code parameter (GET/POST), circuit_json (POST), or fs_map (GET/POST) provided",
  )
})
