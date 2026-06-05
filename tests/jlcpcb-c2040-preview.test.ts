import { test, expect } from "bun:test"
import { handleRequest } from "../handle-request"
import c2040CircuitJson from "./fixtures/jlcpcb-c2040-preview.circuit.json"

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10]

// Freeze the resolved JLCPCB footprint so this regression test stays offline.
const createPreviewRequest = (svgType: "pcb" | "3d", format?: "png") => {
  const searchParams = new URLSearchParams({
    svg_type: svgType,
  })

  if (format) {
    searchParams.set("format", format)
  }

  return new Request(`http://localhost/?${searchParams.toString()}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      circuit_json: c2040CircuitJson,
    }),
  })
}

test("jlcpcb:C2040 renders in pcb svg and 3d previews", async () => {
  const pcbResponse = await handleRequest(createPreviewRequest("pcb"))
  const pcbSvgContent = await pcbResponse.text()

  expect(pcbResponse.status).toBe(200)
  await expect(pcbSvgContent).toMatchSvgSnapshot(import.meta.path)

  const svg3dResponse = await handleRequest(createPreviewRequest("3d"))
  const svg3dContent = await svg3dResponse.text()

  expect(svg3dResponse.status).toBe(200)
  expect(svg3dResponse.headers.get("content-type")).toContain("image/svg+xml")
  await expect(svg3dContent).toMatch3dSvgSnapshot(import.meta.path, "3d")

  const png3dResponse = await handleRequest(createPreviewRequest("3d", "png"))
  const png3dBuffer = new Uint8Array(await png3dResponse.arrayBuffer())

  expect(png3dResponse.status).toBe(200)
  expect(png3dResponse.headers.get("content-type")).toContain("image/png")
  expect(Array.from(png3dBuffer.slice(0, pngSignature.length))).toEqual(
    pngSignature,
  )
  expect(png3dBuffer.byteLength).toBeGreaterThan(1000)
  await expect(Buffer.from(png3dBuffer)).toMatchPngSnapshot(
    import.meta.path,
    "jlcpcb-c2040-preview-3d",
  )
}, 300000)
