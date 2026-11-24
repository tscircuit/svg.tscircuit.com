import { expect, test } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { getTestServer } from "./fixtures/get-test-server"

test("hosted TSX renders a wire harness sheet with its wiring list, parts list and balloons", async () => {
  const { serverUrl } = await getTestServer()
  const code = `import { assembly } from "@tscircuit/core"
export default () => <assembly.device>
  <board width={50} height={25} routingDisabled>
    <connector name="J1" standard="jst_ph" pinCount={6} pcbX={-15} footprint="jst6_ph" />
    <connector name="J2" standard="jst_ph" pinCount={6} pcbX={15} footprint="jst6_ph" />
  </board>
  <assembly.cable name="MOTOR_CABLE" from=".J1" to=".J2" length="50mm" lengthTolerance="3mm" fromConnectorName="H1" toConnectorName="H2" wireAwg="22awg">
    <assembly.cablewire fromPin={1} toPin={1} color="black" />
    <assembly.cablewire fromPin={3} toPin={4} color="black" />
    <assembly.cablewire fromPin={4} toPin={3} color="black" />
    <assembly.cablewire fromPin={6} toPin={6} color="black" />
  </assembly.cable>
  <assembly.drawing.page name="motor-cable" size="iso_a4" anchorAlignment="bottom_left">
    <assembly.drawing.titleblock title="PH-6P CABLE, 22AWG, L=50mm" identificationNumber="MOTOR-CABLE" revisionIndex="A" legalOwner="tscircuit" creator="tscircuit" dateOfIssue="2026-11-21" sheetNumber={1} numberOfSheets={1} />
    <assembly.drawing.harnessview name="harness" cableRef="MOTOR_CABLE" centerX={148.5} centerY={148} width={230} height={76} showBalloons />
    <assembly.drawing.wiringtable cableRef="MOTOR_CABLE" title="WIRING" paperX={212} paperY={98} anchorAlignment="top_left" />
    <assembly.drawing.bomtable partRef="MOTOR_CABLE" paperX={5} paperY={5} anchorAlignment="bottom_left" />
  </assembly.drawing.page>
</assembly.device>`
  const url = new URL(serverUrl)
  url.searchParams.set("svg_type", "drawing")
  url.searchParams.set("code", getCompressedBase64SnippetString(code))
  const image = await fetch(url)
  const svg = await image.text()
  expect(image.status, svg).toBe(200)
  expect(image.headers.get("X-Drawing-Page-Count")).toBe("1")
  expect(svg).toContain("data-drawing-wiring-harness-view-id")
  expect(svg.match(/data-drawing-balloon-id/g)).toHaveLength(3)
  expect(svg).toContain("JST PH housing, 6 position")
  expect(svg).toContain("50±3mm")
  expect(svg).toMatchSvgSnapshot(import.meta.path)
}, 60_000)
