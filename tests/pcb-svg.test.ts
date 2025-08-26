import { test, expect } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { CircuitRunner } from "@tscircuit/eval/eval"

test("basic tscircuit code to pcb svg conversion", async () => {
  const { serverUrl } = await getTestServer()

  const response = await fetch(
    `${serverUrl}?svg_type=pcb&code=${encodeURIComponent(
      getCompressedBase64SnippetString(`
export default () => (
  <board width="10mm" height="10mm">
    <resistor
      resistance="1k"
      footprint="0402"
      name="R1"
      schX={3}
      pcbX={3}
    />
    <capacitor
      capacitance="1000pF"
      footprint="0402"
      name="C1"
      schX={-3}
      pcbX={-3}
    />
    <trace from=".R1 > .pin1" to=".C1 > .pin1" />
  </board>
)
    `),
    )}`,
  )
  const svgContent = await response.text()

  expect(svgContent).toMatchSvgSnapshot(import.meta.path)
})

test("circuit_json to pcb svg conversion", async () => {
  const { serverUrl } = await getTestServer()

  const worker = new CircuitRunner()
  const userCode = `
export default () => (
  <board width="10mm" height="10mm">
    <resistor
      resistance="1k"
      footprint="0402"
      name="R1"
      schX={3}
      pcbX={3}
    />
    <capacitor
      capacitance="1000pF"
      footprint="0402"
      name="C1"
      schX={-3}
      pcbX={-3}
    />
    <trace from=".R1 > .pin1" to=".C1 > .pin1" />
  </board>
)
`

  await worker.executeWithFsMap({
    fsMap: {
      "entrypoint.tsx": `
        import * as UserComponents from "./UserCode.tsx";

        const ComponentToRender = Object.entries(UserComponents)
          .filter(([name]) => !name.startsWith("use"))
          .map(([_, component]) => component)[0] || (() => null);

        circuit.add(
          <ComponentToRender />
        );
      `,
      "UserCode.tsx": userCode,
    },
    entrypoint: "entrypoint.tsx",
  })

  await worker.renderUntilSettled()
  const circuitJson = await worker.getCircuitJson()
  const encodedJson = Buffer.from(JSON.stringify(circuitJson)).toString(
    "base64",
  )

  const response = await fetch(
    `${serverUrl}?svg_type=pcb&circuit_json=${encodeURIComponent(encodedJson)}`,
  )
  const svgContent = await response.text()

  expect(svgContent).toMatchSvgSnapshot(import.meta.path)
})
