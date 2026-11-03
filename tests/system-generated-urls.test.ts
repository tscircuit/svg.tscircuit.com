import { expect, test } from "bun:test"
import { createGeneratedSvgUrls } from "../lib/createGeneratedSvgUrls"
import { getHtmlForGeneratedUrlPage } from "../get-html-for-generated-url-page"

const code = await Bun.file(
  new URL("./fixtures/system-blocks.circuit.tsx", import.meta.url),
).text()

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
