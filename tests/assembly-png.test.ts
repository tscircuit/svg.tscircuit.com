import { test, expect } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { getTestServer } from "./fixtures/get-test-server"

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10]

test("renders assembly view to png when requested", async () => {
  const { serverUrl } = await getTestServer()

  const response = await fetch(
    `${serverUrl}?svg_type=assembly&format=png&code=${encodeURIComponent(
      getCompressedBase64SnippetString(`
export default () => (
  <board width="10mm" height="10mm">
    <resistor
      resistance="1k"
      footprint="0402"
      name="R1"
      schX={3}
      pcbX={3}
    />
    <capacitor
      capacitance="1000pF"
      footprint="0402"
      name="C1"
      schX={-3}
      pcbX={-3}
    />
    <trace from=".R1 > .pin1" to=".C1 > .pin1" />
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

  await expect(Buffer.from(buffer)).toMatchPngSnapshot(import.meta.path)
})
