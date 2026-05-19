import { test, expect } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10]

const c2040Snippet = `
export default () => (
<board width="20mm" height="20mm">
  <resistor
    name="R1"
    resistance="10k"
    footprint="jlcpcb:C2040"
    pcbX={0}
  />
</board>
)
`

test("RP2040 with jlcpcb:C2040 renders in pcb svg and 3d previews", async () => {
  const { serverUrl } = await getTestServer()
  const encodedSnippet = encodeURIComponent(
    getCompressedBase64SnippetString(c2040Snippet),
  )

  const pcbResponse = await fetch(
    `${serverUrl}?svg_type=pcb&code=${encodedSnippet}`,
  )
  const pcbSvgContent = await pcbResponse.text()

  expect(pcbResponse.status).toBe(200)
  expect(pcbSvgContent).toMatchSvgSnapshot(import.meta.path)

  const svg3dResponse = await fetch(
    `${serverUrl}?svg_type=3d&code=${encodedSnippet}`,
  )
  const svg3dContent = await svg3dResponse.text()

  expect(svg3dResponse.status).toBe(200)
  expect(svg3dContent).toContain("<svg")

  const png3dResponse = await fetch(
    `${serverUrl}?svg_type=3d&format=png&code=${encodedSnippet}`,
  )
  const png3dBuffer = new Uint8Array(await png3dResponse.arrayBuffer())

  expect(png3dResponse.status).toBe(200)
  expect(png3dResponse.headers.get("content-type")).toContain("image/png")
  expect(Array.from(png3dBuffer.slice(0, pngSignature.length))).toEqual(
    pngSignature,
  )
  expect(png3dBuffer.byteLength).toBeGreaterThan(1000)
  await expect(Buffer.from(png3dBuffer)).toMatchPngSnapshot(
    import.meta.path,
    "jlcpcb-c2040-preview-3d",
  )
}, 300000)
