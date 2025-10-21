import { expect, test } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { getTestServer } from "./fixtures/get-test-server"

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10]

// Exact code from the user's example
const referenceDesignatorTestSnippet = `
export default () => (
  <board>
    <chip
      name="U1"
      footprint="soic8"
      cadModel={
        <cadmodel
          modelUrl="https://modelcdn.tscircuit.com/jscad_models/soic8.glb"
        />
      }
    />
  </board>
)
`

test("3d png should render reference designator U1", async () => {
  const { serverUrl } = await getTestServer()
  const encodedSnippet = encodeURIComponent(
    getCompressedBase64SnippetString(referenceDesignatorTestSnippet),
  )

  const response = await fetch(
    `${serverUrl}?svg_type=3d&format=png&code=${encodedSnippet}`,
  )

  expect(response.status).toBe(200)
  expect(response.headers.get("content-type")).toContain("image/png")

  const buffer = new Uint8Array(await response.arrayBuffer())
  expect(Array.from(buffer.slice(0, pngSignature.length))).toEqual(pngSignature)
  expect(buffer.byteLength).toBeGreaterThan(1000)

  // PNG snapshot test - this will help us see if the reference designator is rendered
  await expect(Buffer.from(buffer)).toMatchPngSnapshot(import.meta.path)
}, { timeout: 30000 })
