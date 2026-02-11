import { expect, test } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { getTestServer } from "./fixtures/get-test-server"

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10]

const cadModelBoardSnippet = `
export default () => (
  <board>
    <chip
      name="U1"
      footprint="soic8"
      cadModel={
        <cadmodel
          modelUrl="https://modelcdn.tscircuit.com/jscad_models/soic8.step"
          rotationOffset={{ x: 0, y: 180, z: 180 }}
        />
      }
    />
  </board>
)
`

test(
  "renders 3d view with STEP cadmodel and infinite grid to png",
  async () => {
    const { serverUrl } = await getTestServer()
    const encodedSnippet = encodeURIComponent(
      getCompressedBase64SnippetString(cadModelBoardSnippet),
    )

    const response = await fetch(
      `${serverUrl}?svg_type=3d&format=png&background_color=%23ffffff&show_infinite_grid=true&code=${encodedSnippet}`,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("image/png")
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=86400, s-maxage=31536000, immutable",
    )

    const buffer = new Uint8Array(await response.arrayBuffer())
    expect(Array.from(buffer.slice(0, pngSignature.length))).toEqual(
      pngSignature,
    )
    expect(buffer.byteLength).toBeGreaterThan(1000)

    // PNG snapshot test
    await expect(Buffer.from(buffer)).toMatchPngSnapshot(import.meta.path)
  },
  { timeout: 30000 },
)
