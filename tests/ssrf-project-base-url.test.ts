import { expect, test } from "bun:test"
import getPort from "get-port"
import { handleRequest } from "../handle-request"

const staticAssetFsMap = {
  "index.tsx": `import "./probe.kicad_pcb"

export default () => (
  <board width="10mm" height="10mm">
    <chip name="U1" footprint="soic8" />
  </board>
)
`,
  "probe.kicad_pcb": "__STATIC_ASSET__",
}

test("rejects internal and non-https project_base_url values with 400 and zero server-side fetches", async () => {
  let fetchHits = 0
  const probePort = await getPort()
  const probeServer = Bun.serve({
    port: probePort,
    fetch() {
      fetchHits++
      return new Response("secret-internal-response", { status: 200 })
    },
  })

  try {
    const internalTargets = [
      `http://127.0.0.1:${probePort}`,
      `https://127.0.0.1:${probePort}`,
      `https://localhost:${probePort}`,
      "https://169.254.169.254",
      "https://10.0.0.1",
      "https://192.168.1.1",
      "https://metadata.google.internal",
    ]

    for (const target of internalTargets) {
      const postRes = await handleRequest(
        new Request("http://localhost/?svg_type=pcb&format=svg", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fs_map: staticAssetFsMap,
            project_base_url: target,
          }),
        }),
      )
      expect(postRes.status).toBe(400)
      const postJson = (await postRes.json()) as {
        ok: boolean
        error: string
      }
      expect(postJson.ok).toBe(false)
      expect(postJson.error).toContain("Invalid project_base_url")

      const queryRes = await handleRequest(
        new Request(
          `http://localhost/?svg_type=pcb&format=svg&project_base_url=${encodeURIComponent(target)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fs_map: staticAssetFsMap,
            }),
          },
        ),
      )
      expect(queryRes.status).toBe(400)
      const queryJson = (await queryRes.json()) as {
        ok: boolean
        error: string
      }
      expect(queryJson.ok).toBe(false)
      expect(queryJson.error).toContain("Invalid project_base_url")
    }

    expect(fetchHits).toBe(0)
  } finally {
    probeServer.stop(true)
  }
})

test("accepts a valid public https project_base_url in request context validation", async () => {
  const response = await handleRequest(
    new Request(
      "http://localhost/?debug=1&project_base_url=https%3A%2F%2Fraw.githubusercontent.com%2Ftscircuit%2Fcore%2Fmain",
    ),
  )

  expect(response.status).toBe(200)
  const html = await response.text()
  expect(html).toContain(
    "https://raw.githubusercontent.com/tscircuit/core/main",
  )
})
