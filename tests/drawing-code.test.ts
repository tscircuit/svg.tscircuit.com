import { expect, test } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { getTestServer } from "./fixtures/get-test-server"

test("hosted TSX drawing pages evaluate with the drawing-capable core", async () => {
  const { serverUrl } = await getTestServer()
  const code = `import { assembly } from "@tscircuit/core"
export default () => <assembly.device name="fixture">
  <board name="carrier" width="40mm" height="30mm"><hole diameter="3.2mm" pcbX={10} pcbY={10} /></board>
  <assembly.drawing.page name="plan" width="80mm" height="60mm"><assembly.drawing.partview partRef=".carrier" direction="z+" width="60mm" height="40mm" /></assembly.drawing.page>
  <assembly.drawing.page name="overview" width="80mm" height="60mm"><assembly.drawing.partview partRef=".carrier" direction="isometric" width="60mm" height="40mm" /></assembly.drawing.page>
</assembly.device>`
  const url = new URL(serverUrl)
  url.searchParams.set("svg_type", "drawing")
  url.searchParams.set("code", getCompressedBase64SnippetString(code))
  url.searchParams.set("drawing_manifest", "true")
  const manifest = await fetch(url)
  expect(manifest.status).toBe(200)
  expect(
    (await manifest.json()).pages.map((p: { name: string }) => p.name),
  ).toEqual(["plan", "overview"])
  url.searchParams.delete("drawing_manifest")
  url.searchParams.set("drawing_page", "2")
  const image = await fetch(url)
  expect(image.status).toBe(200)
  expect(await image.text()).toMatchSvgSnapshot(import.meta.path)
}, 60_000)
