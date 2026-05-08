import { test, expect } from "bun:test"
import { readFileSync } from "node:fs"
import { getTestServer } from "./fixtures/get-test-server"

test("POST /generate_urls returns HTML without re-reading the body", async () => {
  const { serverUrl } = await getTestServer()

  const response = await fetch(`${serverUrl}/generate_urls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fs_map: {
        "index.tsx": `export default () => (
  <board width="10mm" height="10mm">
    <resistor resistance="1k" footprint="0402" name="R1" schX={3} pcbX={3} />
  </board>
)`,
      },
      entrypoint: "index.tsx",
    }),
  })

  expect(response.status).toBe(200)
  expect(response.headers.get("content-type")).toContain("text/html")
  const html = await response.text()
  expect(html).toContain("svg.tscircuit.com - Generated URLs")
})

test("POST /generate_urls handles STEP-sized fs_map files", async () => {
  const { serverUrl } = await getTestServer()
  const stepFile = readFileSync(
    new URL("./fixtures/soic8.step", import.meta.url),
    "utf8",
  )

  const response = await fetch(`${serverUrl}/generate_urls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fs_map: {
        "index.tsx": `
import soic8StepUrl from "./soic8.step"

export default () => (
  <board>
    <chip
      name="U1"
      footprint="soic8"
      cadModel={<cadmodel modelUrl={soic8StepUrl} />}
    />
  </board>
)
`,
        "soic8.step": stepFile,
      },
      entrypoint: "index.tsx",
    }),
  })

  expect(response.status).toBe(200)
  expect(response.headers.get("content-type")).toContain("text/html")
  const html = await response.text()
  expect(html).toContain("svg.tscircuit.com - Generated URLs")
  expect(html).toContain("svg_type=3d")
  expect(html).toContain("too large for reliable GET URLs")
  expect(html).toContain('class="render-button"')
  expect(html).toContain('data-action="http://localhost')
  expect(html).toContain('"main_component_path":"index.tsx"')
  expect(html).not.toContain('"entrypoint"')
  expect(html).toContain("svg_type=pcb")
  expect(html).toContain("svg_type=schematic")
  expect(html).toContain("svg_type=assembly")
  expect(html).toContain("svg_type=pinout")
  expect(html).toContain("svg_type=3d")
  expect(html).not.toContain("format=png&amp;code=")

  const payloadMatch = html.match(
    new RegExp(
      '<script id="post-payload" type="application/json">([\\s\\S]*?)</script>',
    ),
  )
  expect(payloadMatch).not.toBeNull()
  const payload = JSON.parse(payloadMatch![1])
  const renderResponse = await fetch(`${serverUrl}/?svg_type=3d&format=png`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  expect(renderResponse.status).toBe(200)
  expect(renderResponse.headers.get("content-type")).toContain("image/png")
})
