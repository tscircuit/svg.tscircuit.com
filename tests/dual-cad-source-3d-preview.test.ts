import { test, expect } from "bun:test"
import { readFileSync } from "node:fs"
import { convertCircuitJsonToGltf } from "circuit-json-to-gltf"
import { renderGLTFToPNGBufferFromGLBBuffer } from "poppygl"
import { handleRequest } from "../handle-request"

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10]

const stepFixtureContents = readFileSync(
  new URL("./fixtures/soic8.step", import.meta.url),
  "utf8",
)

const fsMap = {
  "index.tsx": `
import stepUrl from "./fixtures/soic12(1).step"

export default () => (
  <board>
    <chip
      name="U1"
      footprint="soic8"
      cadModel={<cadmodel modelUrl={stepUrl} />}
    />
  </board>
)
`,
  "fixtures/soic12(1).step": stepFixtureContents,
}

const createCircuitJsonRequest = () =>
  new Request("http://localhost/?svg_type=3d&format=circuit_json", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fs_map: fsMap,
      main_component_path: "index.tsx",
    }),
  })

const createPngRequest = (circuitJson: unknown) =>
  new Request("http://localhost/?svg_type=3d&format=png", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      circuit_json: circuitJson,
    }),
  })

const renderPngWithLegacyCadSourceSelection = async (circuitJson: any) => {
  const glbResult = (await convertCircuitJsonToGltf(circuitJson, {
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

test("falls back cleanly when a dual-source CAD model has an unreachable OBJ asset", async () => {
  const circuitJsonResponse = await handleRequest(createCircuitJsonRequest())
  expect(circuitJsonResponse.status).toBe(200)

  const circuitJson = (await circuitJsonResponse.json()) as Array<
    Record<string, unknown>
  >
  const dualSourceCircuitJson = circuitJson.map((item) =>
    item.type === "cad_component"
      ? {
          ...item,
          model_obj_url: "https://127.0.0.1:9/missing.obj",
        }
      : item,
  )

  await expect(
    renderPngWithLegacyCadSourceSelection(dualSourceCircuitJson),
  ).rejects.toThrow(
    /Was there a typo in the url or port\?|Unable to connect\. Is the computer able to access the url\?/,
  )

  const response = await handleRequest(createPngRequest(dualSourceCircuitJson))
  expect(response.status).toBe(200)
  expect(response.headers.get("content-type")).toContain("image/png")

  const buffer = new Uint8Array(await response.arrayBuffer())
  expect(Array.from(buffer.slice(0, pngSignature.length))).toEqual(pngSignature)
  expect(buffer.byteLength).toBeGreaterThan(1000)
  await expect(Buffer.from(buffer)).toMatchPngSnapshot(import.meta.path)
}, 30000)
