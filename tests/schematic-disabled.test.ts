import { expect, test } from "bun:test"
import { getCompressedBase64SnippetString } from "@tscircuit/create-snippet-url"
import { gzipSync } from "node:zlib"
import { handleRequest } from "../handle-request"
import testCircuitJson from "./fixtures/test-circuit.json"

const pcbOnly = testCircuitJson.filter(
  (element) => !element.type.startsWith("schematic_"),
)

const expectUnavailable = async (response: Response) => {
  expect(response.status).toBe(404)
  expect(response.headers.get("content-type")).toContain("application/json")
  expect(response.headers.get("cache-control")).toBe("no-store")
  expect(response.headers.get("cdn-cache-control")).toBe("no-store")
  expect(await response.json()).toEqual({
    ok: false,
    error_code: "schematic_not_available",
    error: "Schematic not available for circuit",
  })
}

test("schematic SVG and PNG reject circuit JSON without schematic elements", async () => {
  for (const circuitJson of [pcbOnly, []]) {
    for (const format of ["svg", "png"]) {
      for (const method of ["GET", "POST"]) {
        const url = new URL("http://localhost/?view=schematic")
        url.searchParams.set("format", format)
        if (method === "GET") {
          url.searchParams.set(
            "circuit_json",
            gzipSync(JSON.stringify(circuitJson)).toString("base64"),
          )
        }
        const response = await handleRequest(
          new Request(url, {
            method,
            ...(method === "POST"
              ? { body: JSON.stringify({ circuit_json: circuitJson }) }
              : {}),
          }),
        )
        await expectUnavailable(response)
      }
    }
  }
})

test("schematicDisabled source rejects schematic images while PCB and JSON remain available", async () => {
  const code = getCompressedBase64SnippetString(
    'export default () => <board width="10mm" height="10mm" schematicDisabled><resistor name="R1" resistance="1k" footprint="0402" /></board>',
  )
  for (const format of ["svg", "png"]) {
    const url = new URL("http://localhost/?svg_type=schematic")
    url.searchParams.set("code", code)
    url.searchParams.set("format", format)
    await expectUnavailable(await handleRequest(new Request(url)))
  }
  for (const format of ["svg", "png", "circuit_json"]) {
    const url = new URL("http://localhost/?svg_type=pcb")
    url.searchParams.set("code", code)
    url.searchParams.set("format", format)
    const response = await handleRequest(new Request(url))
    expect(response.status).toBe(200)
    if (format === "circuit_json") {
      const circuitJson = await response.json()
      expect(
        circuitJson.some((element: { type: string }) =>
          element.type.startsWith("schematic_"),
        ),
      ).toBe(false)
      expect(
        circuitJson.some(
          (element: { type: string }) => element.type === "pcb_board",
        ),
      ).toBe(true)
    } else {
      expect(response.headers.get("content-type")).toContain("image/")
      await response.arrayBuffer()
    }
  }
}, 30_000)

test("circuits with schematic elements still render SVG and PNG", async () => {
  for (const format of ["svg", "png"]) {
    const response = await handleRequest(
      new Request(`http://localhost/?svg_type=schematic&format=${format}`, {
        method: "POST",
        body: JSON.stringify({ circuit_json: testCircuitJson }),
      }),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toContain(
      format === "svg" ? "image/svg+xml" : "image/png",
    )
    if (format === "svg") {
      expect(await response.text()).toContain("<svg")
    } else {
      expect(
        Array.from(new Uint8Array(await response.arrayBuffer()).slice(0, 8)),
      ).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    }
  }
})
