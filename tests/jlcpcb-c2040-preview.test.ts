import { expect, test } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { getTestServer } from "./fixtures/get-test-server"

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10]

const jlcpcbC2040Snippet = `
export default () => (
  <board width="20mm" height="20mm">
    <chip
      name="U1"
      manufacturerPartNumber="RP2040"
      footprint="jlcpcb:C2040"
    />
  </board>
)
`

test(
  "renders a docs-style jlcpcb:C2040 preview with CAD metadata",
  async () => {
    const { serverUrl } = await getTestServer()
    const encodedSnippet = encodeURIComponent(
      getCompressedBase64SnippetString(jlcpcbC2040Snippet),
    )

    const circuitJsonResponse = await fetch(
      `${serverUrl}?format=circuit_json&code=${encodedSnippet}`,
    )

    expect(circuitJsonResponse.status).toBe(200)
    expect(circuitJsonResponse.headers.get("content-type")).toContain(
      "application/json",
    )

    const circuitJson = (await circuitJsonResponse.json()) as Array<
      Record<string, unknown>
    >

    const cadComponent = circuitJson.find(
      (item) => item.type === "cad_component",
    )
    const modelObjUrl =
      typeof cadComponent?.model_obj_url === "string"
        ? cadComponent.model_obj_url
        : undefined
    const modelStepUrl =
      typeof cadComponent?.model_step_url === "string"
        ? cadComponent.model_step_url
        : undefined

    expect(cadComponent).toBeDefined()
    expect(modelObjUrl ?? modelStepUrl).toBeDefined()

    const pngResponse = await fetch(
      `${serverUrl}?svg_type=3d&format=png&background_color=%23ffffff&code=${encodedSnippet}`,
    )

    expect(pngResponse.status).toBe(200)
    expect(pngResponse.headers.get("content-type")).toContain("image/png")
    expect(pngResponse.headers.get("cache-control")).toBe(
      "public, max-age=86400, s-maxage=31536000, immutable",
    )

    const buffer = new Uint8Array(await pngResponse.arrayBuffer())
    expect(Array.from(buffer.slice(0, pngSignature.length))).toEqual(
      pngSignature,
    )
    expect(buffer.byteLength).toBeGreaterThan(1000)

    await expect(Buffer.from(buffer)).toMatchPngSnapshot(import.meta.path)
  },
  { timeout: 30000 },
)
