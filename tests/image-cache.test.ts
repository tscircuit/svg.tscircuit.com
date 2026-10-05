import { expect, test } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { getTestServer } from "./fixtures/get-test-server"

test("all generated image views refresh daily and can serve stale successes", async () => {
  const { serverUrl } = await getTestServer()
  const code = getCompressedBase64SnippetString(
    'export default () => <board width="10mm" height="10mm"><resistor name="R1" resistance="1k" footprint="0402" /></board>',
  )
  for (const view of ["pcb", "schematic", "pinout", "assembly", "3d"]) {
    for (const format of ["svg", "png"]) {
      const url = new URL(serverUrl)
      url.searchParams.set("code", code)
      url.searchParams.set("svg_type", view)
      url.searchParams.set("format", format)
      url.searchParams.set("png_width", "96")
      const response = await fetch(url)
      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toContain("image/")
      const browser = response.headers.get("cache-control")!
      const cdn = response.headers.get("cdn-cache-control")!
      expect(browser).toContain("max-age=300")
      expect(browser).not.toContain("immutable")
      expect(cdn).toContain("s-maxage=43200")
      expect(cdn).toContain("stale-while-revalidate=604800")
      expect(cdn).toContain("stale-if-error=604800")
      await response.arrayBuffer()
    }
  }
}, 30_000)

test("failed SVG and PNG renders cannot poison a cached successful image", async () => {
  const { serverUrl } = await getTestServer()
  for (const format of ["svg", "png"]) {
    const response = await fetch(
      `${serverUrl}?svg_type=pcb&format=${format}&code=invalid`,
    )
    expect(response.status).toBe(500)
    expect(response.headers.get("content-type")).toContain("image/")
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("cdn-cache-control")).toBe("no-store")
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0)
  }
})
