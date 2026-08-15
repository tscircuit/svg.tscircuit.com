import { expect, test } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { getTestServer } from "./fixtures/get-test-server"

const TEMPLATE_PREVIEWS = [
  {
    exportName: "BiscuitBoard",
    props: "",
    usb: { x: 10, y: 0 },
    resistor: { x: 19, y: 2 },
    led: { x: 19, y: -2 },
  },
  {
    exportName: "BreadboardClad",
    props: "markHeadersNoConnect",
    usb: { x: 0, y: 0 },
    resistor: { x: -10, y: 0 },
    led: { x: 10, y: 0 },
  },
  {
    exportName: "Clad40x40",
    props: "",
    usb: { x: 0, y: -10 },
    resistor: { x: -3, y: 8 },
    led: { x: 3, y: 8 },
  },
  {
    exportName: "ArduinoShieldClad",
    props: "markHeadersNoConnect",
    usb: { x: 6, y: 0 },
    resistor: { x: 6, y: 8 },
    led: { x: 12, y: 8 },
  },
  {
    exportName: "BoosterPackClad",
    props: "",
    usb: { x: 0, y: -5 },
    resistor: { x: -3, y: 7 },
    led: { x: 3, y: 7 },
  },
  {
    exportName: "XiaoCladWithPinHeaders",
    props: "markHeadersNoConnect",
    usb: { x: 0, y: 5 },
    resistor: { x: -2, y: -5 },
    led: { x: 2, y: -5 },
  },
  {
    exportName: "XiaoCladWithPerforatedPinHeaders",
    props: "markHeadersNoConnect",
    usb: { x: 0, y: 5 },
    resistor: { x: -2, y: -5 },
    led: { x: 2, y: -5 },
  },
  {
    exportName: "FeatherCladWithPinHeaders",
    props: "markHeadersNoConnect",
    usb: { x: 0, y: 18 },
    resistor: { x: -3, y: 8 },
    led: { x: 3, y: 8 },
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
    <connector name="J_USB" standard="usb_c" pcbX={10} pcbY={0} />
    <resistor
      name="R1"
      resistance="1k"
      footprint="0603"
      pcbX={19}
      pcbY={2}
    />
    <led
      name="LED1"
      footprint="0603"
      pcbX={19}
      pcbY={-2}
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
}, 15_000)

test("renders every Biscuit Board template export", async () => {
  const { serverUrl } = await getTestServer()

  for (const { exportName, props, usb, resistor, led } of TEMPLATE_PREVIEWS) {
    const response = await fetch(
      `${serverUrl}?svg_type=pcb&code=${encodeURIComponent(
        getCompressedBase64SnippetString(`
import { ${exportName} } from "biscuitboard"

export default () => (
  <${exportName}${props ? ` ${props}` : ""}>
    <connector
      name="J_USB"
      standard="usb_c"
      pcbX={${usb.x}}
      pcbY={${usb.y}}
    />
    <resistor
      name="R1"
      resistance="1k"
      footprint="0603"
      pcbX={${resistor.x}}
      pcbY={${resistor.y}}
    />
    <led
      name="LED1"
      footprint="0603"
      pcbX={${led.x}}
      pcbY={${led.y}}
    />
    <trace from=".R1 > .pin2" to=".LED1 > .anode" />
  </${exportName}>
)
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
}, 60_000)
