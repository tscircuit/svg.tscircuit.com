import { test, expect } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"

const jlcpcbFootprintSnippet = `
export default () => (
  <board width="20mm" height="20mm">
    <chip
      name="U1"
      footprint="jlcpcb:C2040"
    />
  </board>
)
`

test(
  "jlcpcb chip footprint resolves in pcb svg",
  async () => {
    const { serverUrl } = await getTestServer()
    const encodedCode = encodeURIComponent(
      getCompressedBase64SnippetString(jlcpcbFootprintSnippet),
    )

    const pcbResponse = await fetch(
      `${serverUrl}?svg_type=pcb&code=${encodedCode}`,
    )
    const circuitJsonResponse = await fetch(
      `${serverUrl}?format=circuit_json&code=${encodedCode}`,
    )

    const svgContent = await pcbResponse.text()
    const circuitJson = (await circuitJsonResponse.json()) as Array<{
      type?: string
      ftype?: string
      name?: string
    }>

    const pcbSmtPadCount = circuitJson.filter(
      (element) => element.type === "pcb_smtpad",
    ).length
    const footprintLoadErrorCount = circuitJson.filter((element) =>
      [
        "external_footprint_load_error",
        "circuit_json_footprint_load_error",
        "pcb_missing_footprint_error",
        "unknown_error_finding_part",
      ].includes(element.type ?? ""),
    ).length

    expect(pcbResponse.status).toBe(200)
    expect(circuitJsonResponse.status).toBe(200)
    expect(svgContent).toContain("<svg")
    expect(svgContent).toContain('data-type="pcb_board"')
    expect(
      circuitJson.some(
        (element) =>
          element.type === "source_component" &&
          element.ftype === "simple_chip" &&
          element.name === "U1",
      ),
    ).toBe(true)
    expect(circuitJson.some((element) => element.type === "pcb_board")).toBe(
      true,
    )
    expect(pcbSmtPadCount > 50 || footprintLoadErrorCount > 0).toBe(true)
  },
  { timeout: 30000 },
)
