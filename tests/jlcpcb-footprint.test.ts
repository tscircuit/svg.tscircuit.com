import { test, expect } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"

test(
  "jlcpcb chip footprint resolves in pcb svg",
  async () => {
    const { serverUrl } = await getTestServer()

    const response = await fetch(
      `${serverUrl}?svg_type=pcb&code=${encodeURIComponent(
        getCompressedBase64SnippetString(`
export default () => (
  <board width="20mm" height="20mm">
    <chip
      name="U1"
      footprint="jlcpcb:C2040"
    />
  </board>
)
        `),
      )}`,
    )
    const svgContent = await response.text()
    const smtPadCount = (svgContent.match(/data-type="pcb_smtpad"/g) ?? []).length
    const silkscreenPathCount =
      (svgContent.match(/data-type="pcb_silkscreen_path"/g) ?? []).length

    expect(response.status).toBe(200)
    expect(svgContent).toContain("<svg")
    expect(svgContent).toContain('data-type="pcb_board"')
    expect(svgContent).toContain('data-pcb-component-id="pcb_component_0"')
    expect(smtPadCount).toBeGreaterThan(50)
    expect(silkscreenPathCount).toBeGreaterThan(10)
  },
  { timeout: 30000 },
)
