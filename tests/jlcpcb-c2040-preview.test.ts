import { test, expect } from "bun:test"
import { readFileSync } from "node:fs"
import { convertCircuitJsonToGltf } from "circuit-json-to-gltf"
import { renderGLTFToPNGBufferFromGLBBuffer } from "poppygl"
import { handleRequest } from "../handle-request"
import c2040CircuitJson from "./fixtures/jlcpcb-c2040-preview.circuit.json"

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10]

const stepFixtureContents = readFileSync(
  new URL("./fixtures/soic8.step", import.meta.url),
  "utf8",
)

const dualCadSourceFsMap = {
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

const createDualCadSourceRequest = (format: "circuit_json" | "png") =>
  new Request(
    `http://localhost/?svg_type=3d&format=${format}&background_color=%23ffffff&show_infinite_grid=true`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fs_map: dualCadSourceFsMap,
        main_component_path: "index.tsx",
      }),
    },
  )

const render3dPngWithLegacyCadSourceSelection = async (circuitJson: any) => {
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

test("jlcpcb:C2040 renders in pcb svg and 3d previews", async () => {
  const pcbResponse = await handleRequest(createPreviewRequest("pcb"))
  const pcbSvgContent = await pcbResponse.text()

  expect(pcbResponse.status).toBe(200)
  await expect(pcbSvgContent).toMatchSvgSnapshot(import.meta.path)

  const dualSourceCircuitJsonResponse = await handleRequest(
    createDualCadSourceRequest("circuit_json"),
  )
  expect(dualSourceCircuitJsonResponse.status).toBe(200)

  const dualSourceCircuitJson =
    (await dualSourceCircuitJsonResponse.json()) as Array<
      Record<string, unknown>
    >
  const mutatedDualSourceCircuitJson = dualSourceCircuitJson.map((item) =>
    item.type === "cad_component"
      ? {
          ...item,
          model_obj_url: "https://127.0.0.1:9/missing.obj",
        }
      : item,
  )

  // The legacy 3D path preferred OBJ first. When that OBJ URL is unreachable,
  // the preview fails even though the same cad_component has a valid STEP model.
  await expect(
    render3dPngWithLegacyCadSourceSelection(mutatedDualSourceCircuitJson),
  ).rejects.toThrow(
    /Was there a typo in the url or port\?|Unable to connect\. Is the computer able to access the url\?/,
  )

  const svg3dResponse = await handleRequest(createPreviewRequest("3d"))
  const svg3dContent = await svg3dResponse.text()

  expect(svg3dResponse.status).toBe(200)
  expect(svg3dResponse.headers.get("content-type")).toContain("image/svg+xml")
  expect(svg3dContent).toContain("<svg")
  expect(svg3dContent).not.toContain("Compilation Error")
  expect(svg3dContent).not.toContain(
    "Unable to connect. Is the computer able to access the url?",
  )

  const fixedDualSourceResponse = await handleRequest(
    new Request("http://localhost/?svg_type=3d&format=png", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        circuit_json: mutatedDualSourceCircuitJson,
      }),
    }),
  )
  const fixedDualSourceBuffer = new Uint8Array(
    await fixedDualSourceResponse.arrayBuffer(),
  )
  expect(fixedDualSourceResponse.status).toBe(200)
  expect(fixedDualSourceResponse.headers.get("content-type")).toContain(
    "image/png",
  )
  expect(
    Array.from(fixedDualSourceBuffer.slice(0, pngSignature.length)),
  ).toEqual(pngSignature)

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
