import { expect, test } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"
import circuitJson from "./fixtures/drawings/carrier.circuit.json"

test("drawing requests list pages and render a selected page by number or name", async () => {
  const { serverUrl } = await getTestServer()
  const post = (query: string) =>
    fetch(`${serverUrl}?svg_type=drawing&${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ circuit_json: circuitJson }),
    })
  const manifest = await post("drawing_manifest=true")
  expect(manifest.status).toBe(200)
  expect(manifest.headers.get("Access-Control-Allow-Origin")).toBe("*")
  expect(
    (await manifest.json()).pages.map((p: { name: string }) => p.name),
  ).toEqual(["carrier-plan", "carrier-side"])
  const selected = await post("drawing_page=2")
  expect(selected.status).toBe(200)
  expect(selected.headers.get("X-Drawing-Page")).toBe("2")
  expect(selected.headers.get("X-Drawing-Page-Count")).toBe("2")
  const svg = await selected.text()
  expect(svg).toContain('data-drawing-part-view-id="side-view"')
  expect(svg).not.toContain('data-drawing-part-view-id="plan-view"')
  expect(svg).toMatchSvgSnapshot(import.meta.path)
  const named = await post("drawing=carrier-plan.svg")
  expect(named.status).toBe(200)
  expect(named.headers.get("X-Drawing-Page")).toBe("1")
  expect(await named.text()).toContain('data-drawing-part-view-id="plan-view"')
  const secondNamed = await post("drawing=carrier-side")
  expect(secondNamed.headers.get("X-Drawing-Page")).toBe("2")
  for (const query of [
    "drawing_page=0",
    "drawing_page=3",
    "drawing_page=1.5",
    "drawing=missing",
    "drawing=carrier-plan&drawing_page=1",
  ]) {
    const response = await post(query)
    expect(response.status).toBe(400)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  }
})
