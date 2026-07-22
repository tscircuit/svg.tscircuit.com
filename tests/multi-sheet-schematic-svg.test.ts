import { expect, test } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { getTestServer } from "./fixtures/get-test-server"

test("multi-sheet schematic code renders every sheet in a stacked SVG", async () => {
  const { serverUrl } = await getTestServer()
  const code = `
const allPinLabels = {
  pin1: "VCC",
  pin2: "GND",
  pin3: "IO0",
  pin4: "IO1",
  pin5: "IO2",
  pin6: "IO3",
  pin7: "IO4",
  pin8: "IO5",
  pin9: "IO6",
  pin10: "IO7",
}

export default () => (
  <board routingDisabled>
    <chip name="U1" pinLabels={allPinLabels} />

    <schematicsheet name="U1 Power" displayName="U1 Power" sheetIndex={0}>
      <schematicbox
        name="U1A"
        chipRef=".U1"
        width={2.245}
        height={1}
        pinLabels={{ pin1: "VCC", pin2: "GND" }}
        schPinArrangement={{
          leftSide: ["pin1", "pin2"],
          rightSide: [],
        }}
      />
      <resistor
        name="R1"
        resistance="1k"
        footprint="0402"
        connections={{ pin1: "U1.VCC" }}
      />
    </schematicsheet>

    <schematicsheet name="U1 I/O" displayName="U1 I/O" sheetIndex={1}>
      <schematicbox
        name="U1B"
        chipRef=".U1"
        width={2.245}
        height={1}
        pinLabels={{ pin1: "IO0", pin2: "IO1" }}
        schPinArrangement={{
          leftSide: ["pin1"],
          rightSide: ["pin2"],
        }}
      />
      <resistor
        name="R2"
        resistance="1k"
        footprint="0402"
        connections={{ pin1: "U1.IO0" }}
      />
    </schematicsheet>

  </board>
)
`

  const response = await fetch(
    `${serverUrl}?svg_type=schematic&code=${encodeURIComponent(
      getCompressedBase64SnippetString(code),
    )}`,
  )
  const svgContent = await response.text()

  expect(svgContent).not.toContain("Compilation Error")
  expect(svgContent).toContain('class="tscircuit-stacked-schematic"')
  expect(svgContent).toContain(">U1 Power</text>")
  expect(svgContent).toContain(">U1 I/O</text>")
  expect(svgContent).toContain(">U1A</text>")
  expect(svgContent).toContain(">U1B</text>")
  expect(svgContent).toMatchSvgSnapshot(import.meta.path)
})
