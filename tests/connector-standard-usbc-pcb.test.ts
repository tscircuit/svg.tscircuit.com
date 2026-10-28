import { test, expect } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"

// Skipped: the parts engine's pick for standard="usb_c" changed, and core
// doesn't yet let manufacturerPartNumber pin a standard connector's part.
// Re-enable and update the snapshot once core honors the MPN.
test.skip("standard usb_c connector resolves in pcb svg", async () => {
  const { serverUrl } = await getTestServer()

  const response = await fetch(
    `${serverUrl}?svg_type=pcb&code=${encodeURIComponent(
      getCompressedBase64SnippetString(`
export default () => (
  <board width="30mm" height="20mm">
    <connector
      name="J_USB"
      standard="usb_c"
      manufacturerPartNumber="TYPE-C 16PIN 2MD(073)"
    />
  </board>
)
      `),
    )}`,
  )

  const svgContent = await response.text()

  expect(svgContent).toMatchSvgSnapshot(import.meta.path)
})
