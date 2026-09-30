import { expect, test } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { getTestServer } from "./fixtures/get-test-server"

const code = `export default () => (
  <board width={10} height={10} layers={4} routeRemaining={false}
    minTraceWidth={0.1} minViaPadDiameter={0.4} minViaHoleDiameter={0.15}>
    <fanout autorouter="dogbone" fanoutRoutingLayers={["inner2"]}>
      <chip name="U1" connections={{pin1: "net.SIGNAL", pin2: "net.VCC", pin3: "net.GND", pin4: "net.DATA"}}
        footprint={<footprint>
          <smtpad portHints={["1"]} shape="circle" radius={0.25} pcbX={0} pcbY={0} />
          <smtpad portHints={["2"]} shape="circle" radius={0.25} pcbX={1} pcbY={0} />
          <smtpad portHints={["3"]} shape="circle" radius={0.25} pcbX={0} pcbY={1} />
          <smtpad portHints={["4"]} shape="circle" radius={0.25} pcbX={1} pcbY={1} />
        </footprint>} />
    </fanout>
    <pcbnotetext pcbY={3} text="Local dogbones: signal, VCC and GND to inner2" fontSize={0.3} />
  </board>
)`

test("renders dogbone fanout for signal and power pads through the code endpoint", async () => {
  const { serverUrl } = await getTestServer()
  const query = `code=${encodeURIComponent(getCompressedBase64SnippetString(code))}`
  const jsonResponse = await fetch(`${serverUrl}?${query}&format=circuit_json`)
  expect(jsonResponse.status).toBe(200)
  const circuit = await jsonResponse.json()
  expect(circuit.filter((e: any) => e.type.endsWith("_error"))).toEqual([])
  expect(circuit.filter((e: any) => e.type === "pcb_via")).toHaveLength(4)
  expect(circuit.filter((e: any) => e.type === "pcb_trace")).toHaveLength(4)
  const response = await fetch(`${serverUrl}?${query}&svg_type=pcb`)
  expect(response.status).toBe(200)
  expect(await response.text()).toMatchSvgSnapshot(import.meta.path)
}, 30_000)
