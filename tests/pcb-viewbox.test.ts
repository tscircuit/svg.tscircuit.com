import { expect, test } from "bun:test"
import { bytesToBase64 } from "../lib/base64"
import { getRequestContext } from "../lib/getRequestContext"
import { getTestServer } from "./fixtures/get-test-server"
import testCircuitJson from "./fixtures/test-circuit.json"

const getFirstPadWidth = (svg: string) => {
  const match = svg.match(/class="pcb-pad"[^>]*width="([\d.]+)"/)
  if (!match) throw new Error("Expected PCB SVG to contain a pad")
  return Number(match[1])
}

test("viewbox query parses PCB coordinates", async () => {
  const ctx = await getRequestContext(
    new Request("https://example.com?viewbox=-4,-2,0,2"),
  )
  if (ctx instanceof Response) throw new Error("Expected request context")

  expect(ctx.pcbViewBox).toEqual({ minX: -4, minY: -2, maxX: 0, maxY: 2 })
})

test("invalid viewbox returns a 400 response", async () => {
  const response = await getRequestContext(
    new Request("https://example.com?viewbox=0,0,0,2"),
  )

  expect(response).toBeInstanceOf(Response)
  expect((response as Response).status).toBe(400)
})

test("PCB viewbox focuses the rendered SVG", async () => {
  const { serverUrl } = await getTestServer()
  const encodedCircuitJson = bytesToBase64(
    new TextEncoder().encode(JSON.stringify(testCircuitJson)),
  )

  const createUrl = (viewbox?: string) => {
    const url = new URL(serverUrl)
    url.searchParams.set("svg_type", "pcb")
    url.searchParams.set("circuit_json", encodedCircuitJson)
    if (viewbox) url.searchParams.set("viewbox", viewbox)
    return url
  }

  const fullSvg = await (await fetch(createUrl())).text()
  const focusedSvg = await (await fetch(createUrl("-4,-2,0,2"))).text()

  expect(getFirstPadWidth(focusedSvg)).toBeGreaterThan(
    getFirstPadWidth(fullSvg),
  )
})
