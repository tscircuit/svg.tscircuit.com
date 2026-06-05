import { test, expect } from "bun:test"
import { createHash } from "node:crypto"
import { convertCircuitJsonToGltf } from "circuit-json-to-gltf"
import { renderGLTFToPNGBufferFromGLBBuffer } from "poppygl"
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

const render3dPngWithLegacyCadSourceSelection = async () => {
  const glbResult = (await convertCircuitJsonToGltf(c2040CircuitJson as any, {
    format: "glb",
  })) as unknown

  let glbBinary: Uint8Array
  if (glbResult instanceof Uint8Array) {
    glbBinary = glbResult
  } else if (glbResult instanceof ArrayBuffer) {
    glbBinary = new Uint8Array(glbResult)
  } else if (ArrayBuffer.isView(glbResult)) {
    const view = glbResult as ArrayBufferView
    glbBinary = new Uint8Array(
      view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength),
    )
  } else {
    throw new Error("GLB conversion did not return binary data")
  }

  return renderGLTFToPNGBufferFromGLBBuffer(glbBinary, {
    width: 1024,
    height: 1024,
    supersampling: 2,
    backgroundColor: null,
    camPos: [7.5, 14, 7.5],
    lookAt: [0, 0, 0],
    grid: false,
  })
}

test("jlcpcb:C2040 renders in pcb svg and 3d previews", async () => {
  const pcbResponse = await handleRequest(createPreviewRequest("pcb"))
  const pcbSvgContent = await pcbResponse.text()

  expect(pcbResponse.status).toBe(200)
  await expect(pcbSvgContent).toMatchSvgSnapshot(import.meta.path)

  // The fixture contains both OBJ and STEP URLs. The legacy 3D path preferred
  // OBJ first, which turned an unreachable EasyEDA CAD asset into this request
  // failing with a connection error instead of rendering the board preview.
  await expect(render3dPngWithLegacyCadSourceSelection()).rejects.toThrow(
    "Unable to connect. Is the computer able to access the url?",
  )

  const svg3dResponse = await handleRequest(createPreviewRequest("3d"))
  const svg3dContent = await svg3dResponse.text()

  expect(svg3dResponse.status).toBe(200)
  expect(svg3dResponse.headers.get("content-type")).toContain("image/svg+xml")
  expect(createHash("sha256").update(svg3dContent).digest("hex")).toBe(
    "18c808126e36e288f3a315fe1004ee9a996955346aaa797e3473990a9221284e",
  )

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
