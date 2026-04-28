import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import endpoint from "../endpoint"

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10]

const stepFixtureContents = readFileSync(
  new URL("./fixtures/soic8.step", import.meta.url),
  "utf8",
)

const fsMap = {
  "index.tsx": `
import stepUrl from "./fixtures/soic12(1).step"

export default () => (
  <board>
    <chip
      name="U1"
      footprint="soic8"
      cadModel={
        <cadmodel modelUrl={stepUrl} />
      }
    />
  </board>
)
`,
  "fixtures/soic12(1).step": stepFixtureContents,
}

const createRequest = (format: "circuit_json" | "png") =>
  new Request(
    `http://localhost/?svg_type=3d&format=${format}&background_color=%23ffffff&show_infinite_grid=true`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fs_map: fsMap,
        main_component_path: "index.tsx",
      }),
    },
  )

test(
  'supports `import stepUrl from "./stepfile.step"` for a path containing parentheses',
  async () => {
    const circuitJsonResponse = await endpoint(createRequest("circuit_json"))

    expect(circuitJsonResponse.status).toBe(200)

    const circuitJson = (await circuitJsonResponse.json()) as Array<
      Record<string, unknown>
    >
    const cadComponent = circuitJson.find(
      (item) => item.type === "cad_component",
    )
    const modelStepUrl =
      typeof cadComponent?.model_step_url === "string"
        ? cadComponent.model_step_url
        : undefined

    expect(modelStepUrl).toBeDefined()
    expect(modelStepUrl?.startsWith("blob:")).toBe(true)
    expect(cadComponent?.model_stl_url).toBeUndefined()

    const response = await endpoint(createRequest("png"))

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("image/png")
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=86400, s-maxage=31536000, immutable",
    )

    const buffer = new Uint8Array(await response.arrayBuffer())
    expect(Array.from(buffer.slice(0, pngSignature.length))).toEqual(
      pngSignature,
    )
    expect(buffer.byteLength).toBeGreaterThan(1000)

    await expect(Buffer.from(buffer)).toMatchPngSnapshot(import.meta.path)
  },
  { timeout: 30000 },
)
