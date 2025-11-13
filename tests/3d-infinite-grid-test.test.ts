import { expect, test } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { getTestServer } from "./fixtures/get-test-server"

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10]

const simpleGridSnippet = `
export default () => (
  <board width="10mm" height="10mm" />
)
`

test(
  "renders 3d infinite grid on white background",
  async () => {
    const { serverUrl } = await getTestServer()
    const encodedCode = encodeURIComponent(
      getCompressedBase64SnippetString(simpleGridSnippet),
    )

    const colorResponse = await fetch(
      `${serverUrl}?svg_type=3d&format=png&background_color=%23ffffff&background_opacity=0&show_infinite_grid=true&code=${encodedCode}`,
    )

    expect(colorResponse.status).toBe(200)
    expect(colorResponse.headers.get("content-type")).toContain("image/png")

    const buffer = new Uint8Array(await colorResponse.arrayBuffer())
    expect(Array.from(buffer.slice(0, pngSignature.length))).toEqual(
      pngSignature,
    )
    expect(buffer.byteLength).toBeGreaterThan(1000)

    await expect(Buffer.from(buffer)).toMatchPngSnapshot(import.meta.path)
  },
  { timeout: 30000 },
)
