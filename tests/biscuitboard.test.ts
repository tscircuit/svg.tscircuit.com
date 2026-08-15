import { expect, test } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { getTestServer } from "./fixtures/get-test-server"

const TEMPLATE_PREVIEWS = [
  { exportName: "BiscuitBoard", props: "routingDisabled" },
  {
    exportName: "BreadboardClad",
    props: "routingDisabled markHeadersNoConnect",
  },
  { exportName: "Clad40x40", props: "routingDisabled" },
  {
    exportName: "ArduinoShieldClad",
    props: "routingDisabled markHeadersNoConnect",
  },
  { exportName: "BoosterPackClad", props: "routingDisabled" },
  {
    exportName: "XiaoCladWithPinHeaders",
    props: "routingDisabled markHeadersNoConnect",
  },
  {
    exportName: "XiaoCladWithPerforatedPinHeaders",
    props: "routingDisabled markHeadersNoConnect",
  },
  {
    exportName: "FeatherCladWithPinHeaders",
    props: "routingDisabled markHeadersNoConnect",
  },
] as const

test("renders the general-purpose Biscuit Board preview", async () => {
  const { serverUrl } = await getTestServer()

  const response = await fetch(
    `${serverUrl}?svg_type=pcb&code=${encodeURIComponent(
      getCompressedBase64SnippetString(`
import { BiscuitBoard } from "biscuitboard"

export default () => (
  <BiscuitBoard>
    <resistor
      name="R1"
      resistance="1k"
      footprint="0603"
      pcbX={-8}
      pcbY={0}
    />
    <led
      name="LED1"
      footprint="0603"
      layer="bottom"
      pcbX={8}
      pcbY={0}
    />
    <trace from=".R1 > .pin2" to=".LED1 > .anode" />
  </BiscuitBoard>
)
      `),
    )}`,
  )
  const svgContent = await response.text()

  expect(response.status).toBe(200)
  expect(svgContent).not.toContain("Cannot find module")
  expect(svgContent).toMatchSvgSnapshot(import.meta.path)
})

test("renders every Biscuit Board template export", async () => {
  const { serverUrl } = await getTestServer()

  for (const { exportName, props } of TEMPLATE_PREVIEWS) {
    const response = await fetch(
      `${serverUrl}?svg_type=pcb&code=${encodeURIComponent(
        getCompressedBase64SnippetString(`
import { ${exportName} } from "biscuitboard"

export default () => <${exportName} ${props} />
          `),
      )}`,
    )
    const svgContent = await response.text()

    if (!response.ok || !svgContent.startsWith("<svg")) {
      throw new Error(
        `${exportName} preview failed (${response.status}): ${svgContent}`,
      )
    }
    expect(svgContent).not.toContain("Cannot find module")
  }
}, 30_000)
