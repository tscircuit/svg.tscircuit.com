import { expect, test } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"

import { readFileSync } from "node:fs"

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10]

const cadModelBoardSnippet = `
import stepUrl from "./soic8.step"
export default () => (
  <board thickness={1.4}>
    <chip
      name="U1"
      footprint="soic8"
      cadModel={
        <cadmodel
          modelUrl={stepUrl}
        />
      }
    />
  </board>
)
`

test(
  "renders 3d view with STEP cadmodel and infinite grid to png",
  async () => {
    const { serverUrl } = await getTestServer()
    const payload = {
      fs_map: {
        "index.tsx": cadModelBoardSnippet,
        "soic8.step": readFileSync(
          new URL("./fixtures/soic8.step", import.meta.url),
          "utf8",
        ),
      },
    }

    const response = await fetch(
      `${serverUrl}?svg_type=3d&format=png&background_color=%23ffffff&show_infinite_grid=true`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("image/png")
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=300, stale-while-revalidate=604800, stale-if-error=604800",
    )

    const buffer = new Uint8Array(await response.arrayBuffer())
    expect(Array.from(buffer.slice(0, pngSignature.length))).toEqual(
      pngSignature,
    )
    expect(buffer.byteLength).toBeGreaterThan(1000)

    // PNG snapshot test
    await expect(Buffer.from(buffer)).toMatchPngSnapshot(import.meta.path)
  },
  { timeout: 30000 },
)
