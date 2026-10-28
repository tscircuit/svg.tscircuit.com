import { expect, test } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { getTestServer } from "./fixtures/get-test-server"

const code = `
export default () => (
  <board width="25mm" height="20mm" routingDisabled>
    <schematicsheet name="Power" displayName="Power" sheetIndex={0} />
    <schematicsheet name="Logic" displayName="Logic" sheetIndex={1} />
    <resistor name="R1" resistance="10k" footprint="0402" schSheetName="Power" />
    <capacitor name="C1" capacitance="100nF" footprint="0402" schSheetName="Logic" />
  </board>
)
`

test("schematic requests list sheets and render a selected sheet", async () => {
  const { serverUrl } = await getTestServer()
  const get = (query: string, source = code) =>
    fetch(
      `${serverUrl}?svg_type=schematic&${query}&code=${encodeURIComponent(
        getCompressedBase64SnippetString(source),
      )}`,
    )

  const manifest = await get("schematic_manifest=true")
  expect(manifest.status).toBe(200)
  expect(manifest.headers.get("Access-Control-Allow-Origin")).toBe("*")
  expect(
    (await manifest.json()).pages.map(
      (page: { name: string; pageNumber: number }) =>
        `${page.pageNumber}:${page.name}`,
    ),
  ).toEqual(["1:Power", "2:Logic"])

  const selected = await get("schematic_sheet=2")
  expect(selected.status).toBe(200)
  expect(selected.headers.get("X-Schematic-Sheet")).toBe("2")
  expect(selected.headers.get("X-Schematic-Sheet-Count")).toBe("2")
  const svg = await selected.text()
  expect(svg).not.toContain("tscircuit-stacked-schematic")
  expect(svg).toContain(">C1</text>")
  expect(svg).not.toContain(">R1</text>")

  for (const query of [
    "schematic_sheet=0",
    "schematic_sheet=3",
    "schematic_sheet=1.5",
  ]) {
    const response = await get(query)
    expect(response.status).toBe(400)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  }

  const singleSheet = await get(
    "schematic_manifest=true",
    `export default () => <board routingDisabled><resistor name="R1" resistance="1k" footprint="0402" /></board>`,
  )
  expect((await singleSheet.json()).pages).toEqual([])
}, 30_000)
