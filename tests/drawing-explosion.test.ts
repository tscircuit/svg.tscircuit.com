import { expect, test } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { handleRequestWithOptions } from "../shared/handle-request"
import { drawingExplosionCode } from "./fixtures/drawing-explosion"

test("TSX explosion drawings inherit moves and render stages, labels and anchored notes", async () => {
  const url = new URL("http://localhost/?format=circuit_json")
  url.searchParams.set(
    "code",
    getCompressedBase64SnippetString(drawingExplosionCode),
  )
  const compiled = await handleRequestWithOptions(new Request(url))
  expect(compiled.status).toBe(200)
  const circuitJson = await compiled.json()
  const views = circuitJson.filter(
    (e: { type: string }) => e.type === "drawing_explosion_view",
  )
  expect(views).toHaveLength(2)
  expect(
    views[0].moves.map((m: { translation: unknown }) => m.translation),
  ).toContainEqual({ x: 6, y: 0, z: 20 })
  expect(views.map((view: { factor: number }) => view.factor).sort()).toEqual([
    0, 1,
  ])
  url.searchParams.set("format", "svg")
  url.searchParams.set("svg_type", "drawing")
  url.searchParams.set("drawing", "explosion")
  const rendered = await handleRequestWithOptions(new Request(url))
  expect(rendered.status).toBe(200)
  const svg = await rendered.text()
  expect(svg).toContain("Cover")
  expect(svg).toContain("Inherited moves")
  expect(svg).toMatchSvgSnapshot(import.meta.path)
  url.searchParams.delete("code")
  const jsonResponse = await handleRequestWithOptions(
    new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ circuit_json: circuitJson }),
    }),
  )
  expect(jsonResponse.status).toBe(200)
  expect(await jsonResponse.text()).toBe(svg)
  url.searchParams.set("drawing", "assembled-pose")
  const assembled = await handleRequestWithOptions(
    new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ circuit_json: circuitJson }),
    }),
  )
  expect(assembled.status).toBe(200)
  expect(await assembled.text()).not.toBe(svg)
}, 60_000)
