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

    expect(response.status).toBe(200)
    expect(svgContent).toMatchSvgSnapshot(import.meta.path)
  },
  { timeout: 30000 },
)
