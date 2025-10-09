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
      cadModel={{
        glbUrl: "https://modelcdn.tscircuit.com/jscad_models/soic8.glb",
      }}
    />
  </board>
)
`

test("renders 3d view with cad model to png", async () => {
  const { serverUrl } = await getTestServer()
  const encodedSnippet = encodeURIComponent(
    getCompressedBase64SnippetString(cadModelBoardSnippet),
  )

  const response = await fetch(
    `${serverUrl}?svg_type=3d&format=png&code=${encodedSnippet}`,
  )

  expect(response.status).toBe(200)
  expect(response.headers.get("content-type")).toContain("image/png")
  expect(response.headers.get("cache-control")).toBe(
    "public, max-age=86400, s-maxage=31536000, immutable",
  )

  const buffer = new Uint8Array(await response.arrayBuffer())
  expect(Array.from(buffer.slice(0, pngSignature.length))).toEqual(pngSignature)
  expect(buffer.byteLength).toBeGreaterThan(1000)
})
