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
import soic8StepUrl from "./models/soic8.step"

export default () => (
  <board>
    <chip
      name="U1"
      footprint="soic8"
      cadModel={
        <cadmodel
          modelUrl={soic8StepUrl}
        />
      }
    />
  </board>
)
`,
  "./models/soic8.step": "__STATIC_ASSET__",
}

test(
  "renders docs-style local STEP cadmodel from static asset fs_map",
  async () => {
    const server = Bun.serve({
      port: 0,
      fetch: async (req) => {
        const url = new URL(req.url)
        if (url.pathname === "/models/soic8.step") {
          return new Response(stepFixtureContents, {
            headers: { "Content-Type": "model/step" },
          })
        }
        return endpoint(req)
      },
    })

    const serverUrl = `http://localhost:${server.port}`
    ;(globalThis as any).servers?.push({
      url: serverUrl,
      close: () => server.stop(),
    })

    const createRequest = (format: "circuit_json" | "png") =>
      new Request(
        `${serverUrl}/?svg_type=3d&format=${format}&background_color=%23ffffff&show_infinite_grid=true&project_base_url=${encodeURIComponent(serverUrl)}`,
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

    expect(modelStepUrl).toBe(`${serverUrl}/models/soic8.step`)
    expect(cadComponent?.model_stl_url).toBeUndefined()

    const consoleErrors: unknown[][] = []
    const originalConsoleError = console.error
    console.error = (...args: unknown[]) => {
      consoleErrors.push(args)
      originalConsoleError(...args)
    }

    try {
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
    } finally {
      console.error = originalConsoleError
      server.stop()
    }

    const stepLoadError = consoleErrors.find((args) =>
      args.some(
        (arg) =>
          typeof arg === "string" && arg.includes("Failed to load STEP from"),
      ),
    )
    expect(stepLoadError).toBeUndefined()
  },
  { timeout: 30000 },
)
