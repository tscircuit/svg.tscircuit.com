import { test, expect } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"

test("standard usb_c connector resolves in pcb svg", async () => {
  const { serverUrl } = await getTestServer()

  const response = await fetch(
    `${serverUrl}?svg_type=pcb&code=${encodeURIComponent(
      getCompressedBase64SnippetString(`
export default () => (
  <board width="30mm" height="20mm">
    <connector name="J_USB" standard="usb_c" />
  </board>
)
      `),
    )}`,
  )

  const svgContent = await response.text()

  expect(svgContent).toMatchSvgSnapshot(import.meta.path)
})
