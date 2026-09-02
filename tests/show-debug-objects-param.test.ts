import { expect, test } from "bun:test"
import { getRequestContext } from "../lib/getRequestContext"
import { getTestServer } from "./fixtures/get-test-server"
import testCircuitJson from "./fixtures/test-circuit.json"

test("show_debug_objects parses boolean query values", async () => {
  const enabled = await getRequestContext(
    new Request("https://example.com?show_debug_objects=true"),
  )
  const disabled = await getRequestContext(
    new Request("https://example.com?show_debug_objects=0"),
  )

  if (enabled instanceof Response || disabled instanceof Response) {
    throw new Error("Expected request contexts")
  }

  expect(enabled.showDebugObjects).toBe(true)
  expect(disabled.showDebugObjects).toBe(false)
})

test("show_debug_objects renders PCB debug overlays", async () => {
  const { serverUrl } = await getTestServer()
  const circuitJsonWithDebugObject = [
    ...testCircuitJson,
    {
      type: "pcb_debug_object",
      pcb_debug_object_id: "pcb_debug_object_0",
      shape: "rect",
      center: { x: 0, y: 0 },
      size: { width: 4, height: 3 },
      label: "autorouting phase 0",
    },
  ]
  const requestBody = JSON.stringify({
    circuit_json: circuitJsonWithDebugObject,
  })

  const hiddenResponse = await fetch(`${serverUrl}?svg_type=pcb`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: requestBody,
  })
  const visibleResponse = await fetch(
    `${serverUrl}?svg_type=pcb&show_debug_objects=true`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody,
    },
  )
  const hiddenSvg = await hiddenResponse.text()
  const visibleSvg = await visibleResponse.text()

  expect(hiddenResponse.status).toBe(200)
  expect(visibleResponse.status).toBe(200)
  expect(hiddenSvg).not.toContain('data-type="pcb_debug_object"')
  expect(visibleSvg).toContain('data-type="pcb_debug_object"')
  expect(visibleSvg).toContain("autorouting phase 0")
  expect(visibleSvg).toMatchSvgSnapshot(import.meta.path)
})
