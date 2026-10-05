import { expect, test } from "bun:test"
import { getRequestContext } from "../lib/getRequestContext"
import { getTestServer } from "./fixtures/get-test-server"
import testCircuitJson from "./fixtures/test-circuit.json"

test("realistic parses boolean query values and leaves invalid values unset", async () => {
  for (const [value, expected] of [
    ["true", true],
    ["1", true],
    ["YES", true],
    [" on ", true],
    ["false", false],
    ["0", false],
    ["no", false],
    ["off", false],
    ["invalid", undefined],
    ["", undefined],
  ] as const) {
    const url = new URL("https://example.com")
    url.searchParams.set("realistic", value)
    const ctx = await getRequestContext(new Request(url))
    if (ctx instanceof Response) throw new Error("Expected request context")
    expect(ctx.realistic).toBe(expected)
  }
  const omitted = await getRequestContext(new Request("https://example.com"))
  if (omitted instanceof Response) throw new Error("Expected request context")
  expect(omitted.realistic).toBeUndefined()
})

test("POST realistic overrides the query, including explicit false and zero", async () => {
  for (const [query, body, expected] of [
    ["false", { realistic: true }, true],
    ["true", { realistic: false }, false],
    ["true", { realistic: 0 }, false],
    ["true", { realistic: "false" }, false],
    ["false", { realistic: 1 }, true],
    ["true", {}, true],
    ["false", {}, false],
  ] as const) {
    const ctx = await getRequestContext(
      new Request(`https://example.com?realistic=${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    )
    if (ctx instanceof Response) throw new Error("Expected request context")
    expect(ctx.realistic).toBe(expected)
  }
})

test("GET and POST realistic PNGs agree, and POST false preserves regular output", async () => {
  const { serverUrl } = await getTestServer()
  const baseUrl = `${serverUrl}?svg_type=3d&format=png&png_width=192&png_height=128`
  const encodedJson = encodeURIComponent(
    Buffer.from(JSON.stringify(testCircuitJson)).toString("base64"),
  )
  const getUrl = `${baseUrl}&circuit_json=${encodedJson}`
  const png = async (response: Response) => {
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("image/png")
    // Error images are also PNGs; successful renders carry this cache marker.
    expect(response.headers.get("cache-control")).toContain("immutable")
    const bytes = Buffer.from(await response.arrayBuffer())
    expect(bytes.readUInt32BE(16)).toBe(192)
    expect(bytes.readUInt32BE(20)).toBe(128)
    return bytes
  }
  const regular = await png(await fetch(getUrl))
  const realistic = await png(await fetch(`${getUrl}&realistic=true`))
  expect(realistic.equals(regular)).toBe(false)
  await expect(realistic).toMatchPngSnapshot(import.meta.path)

  const post = (realistic: boolean) => ({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ circuit_json: testCircuitJson, realistic }),
  })
  const fromBody = await png(await fetch(baseUrl, post(true)))
  expect(fromBody.equals(realistic)).toBe(true)
  const disabled = await png(
    await fetch(`${baseUrl}&realistic=true`, post(false)),
  )
  expect(disabled.equals(regular)).toBe(true)
}, 120_000)

test("3D SVG output uses realistic lighting from a POST body", async () => {
  const { serverUrl } = await getTestServer()
  const render = async (realistic: boolean) => {
    const response = await fetch(`${serverUrl}?svg_type=3d`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ circuit_json: testCircuitJson, realistic }),
    })
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain("image/svg+xml")
    expect(response.headers.get("cache-control")).toContain("immutable")
    return response.text()
  }
  const regular = await render(false)
  const realistic = await render(true)
  expect(realistic).toContain("<svg")
  expect(realistic).not.toBe(regular)
  await expect(realistic).toMatch3dSvgSnapshot(import.meta.path)
}, 120_000)

test("realistic has no effect on PCB SVGs", async () => {
  const { serverUrl } = await getTestServer()
  const render = async (realistic: boolean) => {
    const response = await fetch(`${serverUrl}?svg_type=pcb`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ circuit_json: testCircuitJson, realistic }),
    })
    expect(response.status).toBe(200)
    return response.text()
  }
  expect(await render(true)).toBe(await render(false))
})
