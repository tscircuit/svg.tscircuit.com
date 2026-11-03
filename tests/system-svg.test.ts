import { expect, test } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { getTestServer } from "./fixtures/get-test-server"
import { createGeneratedSvgUrls } from "../lib/createGeneratedSvgUrls"
import { getHtmlForGeneratedUrlPage } from "../get-html-for-generated-url-page"

const code = await Bun.file(
  new URL("./fixtures/system-blocks.circuit.tsx", import.meta.url),
).text()

test("hosted system TSX renders the docs example from compressed code and file maps", async () => {
  const { serverUrl } = await getTestServer()
  const response = await fetch(
    `${serverUrl}?svg_type=system&code=${encodeURIComponent(getCompressedBase64SnippetString(code))}`,
  )
  expect(response.status).toBe(200)
  expect(response.headers.get("Content-Type")).toBe("image/svg+xml")
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
  expect(response.headers.get("X-System-Page")).toBe("1")
  expect(response.headers.get("X-System-Page-Count")).toBe("1")
  const svg = await response.text()
  expect(svg).toContain("Environment sensor")
  expect(svg).toContain("I2C")
  expect(svg).toMatchSvgSnapshot(import.meta.path)
  const fsMap = await fetch(`${serverUrl}?view=system`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fs_map: { "overview.tsx": code },
      main_component_path: "overview.tsx",
    }),
  })
  expect(fsMap.status).toBe(200)
  expect(await fsMap.text()).toBe(svg)
}, 30_000)

test("system pages select resolved Circuit JSON and rasterize the same page", async () => {
  const { serverUrl } = await getTestServer()
  const post = (query: string, body: unknown) =>
    fetch(`${serverUrl}?${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  const multiPage = `import { systemblock } from "@tscircuit/core"
export default () => <group subcircuit>
  <systemblock.page name="overview" displayName="Overview">
    <systemblock.component name="controller" displayName="Controller" />
  </systemblock.page>
  <systemblock.page name="power" displayName="Power supply">
    <systemblock.component name="supply" displayName="Battery" />
    <systemblock.component name="regulator" displayName="Regulator" />
    <systemblock.connection from="supply" to="regulator" kind="power" label="3.3 V" />
  </systemblock.page>
</group>`
  const generated = await post("format=circuit_json", {
    fs_map: { "index.tsx": multiPage },
  })
  expect(generated.status).toBe(200)
  const circuitJson = await generated.json()
  const blocks = circuitJson.filter(
    (e: any) => e.type === "system_block_component",
  )
  expect(blocks).toHaveLength(3)
  for (const block of blocks) {
    expect(Number.isFinite(block.center.x)).toBe(true)
    expect(Number.isFinite(block.center.y)).toBe(true)
    expect(block.width).toBeGreaterThan(0)
    expect(block.height).toBeGreaterThan(0)
  }
  const body = { circuit_json: circuitJson }
  const manifest = await post("svg_type=system&system_manifest=true", body)
  expect(manifest.headers.get("Access-Control-Allow-Origin")).toBe("*")
  const pages = (await manifest.json()).pages
  expect(pages.map((p: any) => [p.name, p.pageNumber])).toEqual([
    ["Overview", 1],
    ["Power supply", 2],
  ])
  const first = await post("svg_type=system", body)
  expect(await first.text()).toContain("Controller")
  const second = await post("svg_type=system&system_page=2", body)
  expect(second.status).toBe(200)
  expect(second.headers.get("X-System-Page")).toBe("2")
  expect(second.headers.get("X-System-Page-Count")).toBe("2")
  const secondSvg = await second.text()
  expect(secondSvg).toContain(pages[1].systemBlockPageId)
  expect(secondSvg).toContain("Battery")
  expect(secondSvg).not.toContain("Controller")
  expect(secondSvg).toContain("stroke-dasharray=")
  expect(secondSvg).toMatchSvgSnapshot(import.meta.path, "system-power-page")
  const png = await post(
    "view=system&format=png&system_page=2&png_width=320",
    body,
  )
  expect(png.status).toBe(200)
  expect(png.headers.get("Content-Type")).toBe("image/png")
  expect(png.headers.get("X-System-Page")).toBe("2")
  const bytes = Buffer.from(await png.arrayBuffer())
  expect(bytes.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  )
  expect(bytes.readUInt32BE(16)).toBe(320)
  for (const page of ["0", "-1", "3", "1.5", "abc", "", "9007199254740992"]) {
    const invalid = await post(`svg_type=system&system_page=${page}`, body)
    expect(invalid.status).toBe(400)
    expect(invalid.headers.get("Cache-Control")).toBe("no-store")
    expect(invalid.headers.get("CDN-Cache-Control")).toBe("no-store")
  }
  const empty = { circuit_json: [] }
  expect(
    await (await post("svg_type=system&system_manifest=true", empty)).json(),
  ).toEqual({ pages: [] })
  expect((await post("svg_type=system", empty)).status).toBe(400)
  expect((await post("svg_type=system&format=png", empty)).status).toBe(400)
}, 30_000)

test("generated system URLs preserve server, input and entrypoint", () => {
  const input = { fsMap: { "overview.tsx": code }, entrypoint: "overview.tsx" }
  const urls = createGeneratedSvgUrls(input, "https://preview.example.com")
  for (const value of [
    urls.systemSvgUrl,
    urls.systemPngUrl,
    urls.systemManifestUrl,
  ]) {
    const url = new URL(value)
    expect(url.origin).toBe("https://preview.example.com")
    expect(url.searchParams.get("svg_type")).toBe("system")
    expect(url.searchParams.get("main_component_path")).toBe("overview.tsx")
    expect(url.searchParams.get("fs_map")).toBeTruthy()
  }
  expect(new URL(urls.systemPngUrl).searchParams.get("format")).toBe("png")
  expect(
    new URL(urls.systemManifestUrl).searchParams.get("system_manifest"),
  ).toBe("true")
  expect(getHtmlForGeneratedUrlPage(input)).toContain("System SVG URL")
})
