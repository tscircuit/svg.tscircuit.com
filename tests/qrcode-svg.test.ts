import { test, expect } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"

test("qrcode-svg import renders tscircuit.com as a silkscreen graphic", async () => {
  const { serverUrl } = await getTestServer()

  const response = await fetch(
    `${serverUrl}?svg_type=pcb&code=${encodeURIComponent(
      getCompressedBase64SnippetString(`
import QRCode from "qrcode-svg"

const qr = new QRCode({
  content: "https://tscircuit.com",
  padding: 0,
  join: true,
  container: "svg-viewbox",
})
const qrSvg = qr.svg()
const qrImageUrl = "data:image/svg+xml;base64," + btoa(qrSvg)

export default () => (
  <board width={12} height={12}>
    <silkscreengraphic
      imageUrl={qrImageUrl}
      width={7}
      height={7}
      pcbX={0}
      pcbY={0}
    />
  </board>
)
    `),
    )}`,
  )

  const svgContent = await response.text()
  expect(svgContent).toMatch(/data-type="pcb_silkscreen_graphic"/)
  expect(svgContent).toMatchSvgSnapshot(import.meta.path)
})
