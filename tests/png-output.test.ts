import { test, expect } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { getTestServer } from "./fixtures/get-test-server"
import "./fixtures/png-matcher"

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10]

test("renders pcb view to png when requested", async () => {
  const { serverUrl } = await getTestServer()

  const response = await fetch(
    `${serverUrl}?svg_type=pcb&format=png&code=${encodeURIComponent(
      getCompressedBase64SnippetString(`
export default () => (
  <board width="10mm" height="10mm">
    <led name="LED1" footprint="0603" />
  </board>
)
      `),
    )}`,
  )

  expect(response.status).toBe(200)
  expect(response.headers.get("content-type")).toContain("image/png")
  expect(response.headers.get("cache-control")).toBe(
    "public, max-age=86400, s-maxage=31536000, immutable",
  )

  const buffer = new Uint8Array(await response.arrayBuffer())
  expect(Array.from(buffer.slice(0, pngSignature.length))).toEqual(pngSignature)

  // PNG snapshot test
  await expect(Buffer.from(buffer)).toMatchPngSnapshot(import.meta.path)
})

test("returns png error image when conversion fails", async () => {
  const { serverUrl } = await getTestServer()

  const response = await fetch(
    `${serverUrl}?svg_type=pcb&format=png&code=invalid`,
  )

  expect(response.status).toBe(200)
  expect(response.headers.get("content-type")).toContain("image/png")

  const buffer = new Uint8Array(await response.arrayBuffer())
  expect(Array.from(buffer.slice(0, pngSignature.length))).toEqual(pngSignature)

  // PNG snapshot test for error image
  await expect(Buffer.from(buffer)).toMatchPngSnapshot(
    import.meta.path,
    "png-error",
  )
})
