import { expect, test } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"

// Exercise the deployed evaluation and rendering path, including a self-loop.
const code = `import { systemblock } from "@tscircuit/core"
export default () => <systemblock.page name="control">
  <systemblock.group name="motor" displayName="Motor control">
    <systemblock.component name="controller" displayName="Controller" />
    <systemblock.component name="driver" displayName="Motor driver" />
    <systemblock.connection from="controller" to="controller" label="Watchdog" />
    <systemblock.connection from="controller" to="driver" label="PWM" />
    <systemblock.connection from="driver" to="controller" label="Feedback" />
  </systemblock.group>
</systemblock.page>`

test("hosted system layouts preserve rounded corners and circular self-loops", async () => {
  const { serverUrl } = await getTestServer()
  const post = (query: string, body: unknown) =>
    fetch(`${serverUrl}?${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  const response = await post("format=circuit_json", {
    fs_map: { "index.tsx": code },
  })
  expect(response.status).toBe(200)
  const circuitJson = await response.json()
  const connections = circuitJson.filter(
    (e: any) => e.type === "system_block_connection",
  )
  const loop = connections.find((e: any) => e.label === "Watchdog")
  expect(
    loop.route.filter((point: any) => point.cubic_bezier_control_points),
  ).toHaveLength(2)
  const svgResponse = await post("svg_type=system", {
    circuit_json: circuitJson,
  })
  expect(svgResponse.status).toBe(200)
  const svg = await svgResponse.text()
  expect(svg).toMatch(/d="M[^"\n]*C/)
  expect(svg).toContain("Watchdog")
  expect(svg).toMatchSvgSnapshot(import.meta.path)
}, 30_000)
