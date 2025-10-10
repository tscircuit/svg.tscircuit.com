import { test, expect } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { getTestServer } from "./fixtures/get-test-server"

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10]

test("renders pcb and assembly png outputs and returns error image when conversion fails", async () => {
  const { serverUrl } = await getTestServer()

  const pcbResponse = await fetch(
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

  expect(pcbResponse.status).toBe(200)
  expect(pcbResponse.headers.get("content-type")).toContain("image/png")
  expect(pcbResponse.headers.get("cache-control")).toBe(
    "public, max-age=86400, s-maxage=31536000, immutable",
  )

  const pcbBuffer = new Uint8Array(await pcbResponse.arrayBuffer())
  expect(Array.from(pcbBuffer.slice(0, pngSignature.length))).toEqual(
    pngSignature,
  )
  await expect(Buffer.from(pcbBuffer)).toMatchPngSnapshot(import.meta.path)

  const assemblyResponse = await fetch(
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

  expect(assemblyResponse.status).toBe(200)
  expect(assemblyResponse.headers.get("content-type")).toContain("image/png")
  expect(assemblyResponse.headers.get("cache-control")).toBe(
    "public, max-age=86400, s-maxage=31536000, immutable",
  )

  const assemblyBuffer = new Uint8Array(await assemblyResponse.arrayBuffer())
  expect(Array.from(assemblyBuffer.slice(0, pngSignature.length))).toEqual(
    pngSignature,
  )

  const errorResponse = await fetch(
    `${serverUrl}?svg_type=pcb&format=png&code=invalid`,
  )

  expect(errorResponse.status).toBe(200)
  expect(errorResponse.headers.get("content-type")).toContain("image/png")

  const errorBuffer = new Uint8Array(await errorResponse.arrayBuffer())
  expect(Array.from(errorBuffer.slice(0, pngSignature.length))).toEqual(
    pngSignature,
  )
  await expect(Buffer.from(errorBuffer)).toMatchPngSnapshot(
    import.meta.path,
    "png-error",
  )
})
