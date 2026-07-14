import { test, expect } from "bun:test"
import { getHtmlForGeneratedUrlPage } from "../get-html-for-generated-url-page"
import { getTestServer } from "./fixtures/get-test-server"
import { multipleSimulationCircuitCode } from "./fixtures/multiple-simulation-circuit-code"

test(
  "POST /generate_urls returns one named URL pair per simulation",
  async () => {
    const { serverUrl } = await getTestServer()

    const response = await fetch(`${serverUrl}/generate_urls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fs_map: { "index.tsx": multipleSimulationCircuitCode },
        entrypoint: "index.tsx",
      }),
    })

    const html = await response.text()
    if (!response.ok) {
      throw new Error(
        `Generate URLs request failed (${response.status}): ${html}`,
      )
    }
    expect(response.headers.get("content-type")).toContain("text/html")
    expect(html).toContain("svg.tscircuit.com - Generated URLs")
    for (const name of [
      "Root Fast",
      "Root Slow",
      "Input Group",
      "Output Group",
    ]) {
      expect(html).toContain(`Schematic Simulation SVG URL — ${name}`)
      expect(html).toContain(`Simulation Graph SVG URL — ${name}`)
      expect(html).toContain(
        new URLSearchParams({ simulation_experiment_name: name }).toString(),
      )
    }
  },
  { timeout: 60_000 },
)

test("generated simulation URLs use ids when names are duplicated", () => {
  const html = getHtmlForGeneratedUrlPage(
    "export default () => <board />",
    "https://svg.example.com",
    [
      {
        simulation_experiment_id: "simulation_experiment_0",
        name: "Duplicate",
      },
      {
        simulation_experiment_id: "simulation_experiment_1",
        name: "Duplicate",
      },
    ],
  )

  expect(html).toContain("simulation_experiment_id=simulation_experiment_0")
  expect(html).toContain("simulation_experiment_id=simulation_experiment_1")
  expect(html).not.toContain("simulation_experiment_name=Duplicate")
})

test("generated URL page keeps generic simulation rows without experiments", () => {
  const html = getHtmlForGeneratedUrlPage(
    "export default () => <board />",
    "https://svg.example.com",
  )

  expect(html).toContain("<td>Schematic Simulation SVG URL</td>")
  expect(html).toContain("<td>Simulation Graph SVG URL</td>")
  expect(html).not.toContain("simulation_experiment_name=")
  expect(html).not.toContain("simulation_experiment_id=")
})
