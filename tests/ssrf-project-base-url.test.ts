import { expect, test } from "bun:test"
import getPort from "get-port"
import { getTestServer } from "./fixtures/get-test-server"

// `project_base_url` is accepted from unauthenticated requests (query or POST
// body) and forwarded into the eval platform config, where imports of
// `__STATIC_ASSET__`-marked files are fetched server-side as
// `${projectBaseUrl}/${path}`. Before validation this let anyone make
// svg.tscircuit.com issue GETs to internal-only URLs (loopback ports,
// private-range services, cloud metadata) and read the HTTP status of those
// endpoints through the error SVG — a probing oracle (verified live against
// the deployed service with a harmless https://httpbin.org/status/404 probe,
// which was reflected verbatim into the error SVG).
//
// The fix rejects anything that is not https on a public host at request
// parse time, before any fetch can happen.

const probeBoardSnippet = `
import "./probe.kicad_pcb"

export default () => (
  <board width="10mm" height="10mm">
    <chip name="U1" footprint="soic8" />
  </board>
)
`

const buildFsMap = () => ({
  "index.tsx": probeBoardSnippet,
  "probe.kicad_pcb": "__STATIC_ASSET__",
})

test(
  "internal project_base_url targets are rejected before any fetch",
  async () => {
    const fixturePort = await getPort()
    let fetchHits = 0

    const probeListener = Bun.serve({
      port: fixturePort,
      fetch: () => {
        fetchHits++
        return new Response("x")
      },
    })
    try {
      const { serverUrl } = await getTestServer()

      for (const badUrl of [
        `http://127.0.0.1:${fixturePort}/internal-only-asset-store`,
        `https://127.0.0.1:${fixturePort}/internal-only-asset-store`,
        "https://169.254.169.254/latest/meta-data",
        "https://10.0.0.5/admin",
        "https://192.168.1.10/admin",
        "https://localhost:4242/x.kicad_pcb",
        "https://metadata.google.internal/computeMetadata/v1/",
      ]) {
        const response = await fetch(`${serverUrl}?svg_type=3d&format=svg`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fs_map: buildFsMap(),
            project_base_url: badUrl,
          }),
        })
        expect(response.status).toBe(400)
        expect(await response.json()).toMatchObject({
          ok: false,
          error: expect.stringContaining("Invalid project_base_url"),
        })
      }

      // The same probe also has to be dead through the query-string lane.
      const queryResponse = await fetch(
        `${serverUrl}/svg?svg_type=3d&format=svg&fs_map=${encodeURIComponent(
          JSON.stringify(buildFsMap()),
        )}&project_base_url=${encodeURIComponent(
          `http://127.0.0.1:${fixturePort}/probe`,
        )}`,
      )
      expect(queryResponse.status).toBe(400)

      expect(fetchHits).toBe(0)
    } finally {
      probeListener.stop(true)
    }
  },
  { timeout: 60000 },
)

test("public https project_base_url still resolves project assets", async () => {
  const { serverUrl } = await getTestServer()

  const response = await fetch(`${serverUrl}/svg?svg_type=3d&format=svg`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fs_map: buildFsMap(),
      project_base_url: "https://example.com/assets",
    }),
  })
  // Either the public asset fetch proceeds (and fails on parse, not policy)
  // — never a 400 from the validator itself.
  expect(response.status).not.toBe(400)
})
