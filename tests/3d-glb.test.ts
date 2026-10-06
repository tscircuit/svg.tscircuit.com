import { expect, test } from "bun:test"
import { getTestServer } from "./fixtures/get-test-server"

test("GLB output needs no view and preserves binary bytes; images validate camera presets", async () => {
  const { serverUrl } = await getTestServer()
  const input = {
    circuit_json: [
      {
        type: "pcb_board",
        pcb_board_id: "b1",
        center: { x: 0, y: 0 },
        width: 10,
        height: 8,
        thickness: 1.6,
        num_layers: 2,
      },
    ],
  }
  const response = await fetch(`${serverUrl}?format=glb`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  expect(response.status).toBe(200)
  expect(response.headers.get("Content-Type")).toBe("model/gltf-binary")
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*")
  const bytes = new Uint8Array(await response.arrayBuffer())
  expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("glTF")
  const header = new DataView(bytes.buffer)
  expect(header.getUint32(4, true)).toBe(2)
  expect(header.getUint32(8, true)).toBe(bytes.byteLength)
  for (const query of ["svg_type=3d&format=glb", "view=pcb&format=glb", ""]) {
    const model = await fetch(`${serverUrl}?${query}`, {
      method: "POST",
      body: JSON.stringify({ ...input, output_format: "glb" }),
    })
    expect(model.status).toBe(200)
    expect(new Uint8Array(await model.arrayBuffer())).toEqual(bytes)
  }
  const getModel = await fetch(
    `${serverUrl}?format=glb&circuit_json=${encodeURIComponent(btoa(JSON.stringify(input.circuit_json)))}`,
  )
  expect(getModel.status).toBe(200)
  expect(new Uint8Array(await getModel.arrayBuffer())).toEqual(bytes)
  for (const query of ["svg_type=3d&format=png&camera_preset=invalid"]) {
    const invalid = await fetch(`${serverUrl}?${query}`, {
      method: "POST",
      body: JSON.stringify(input),
    })
    expect(invalid.status).toBe(400)
  }
  for (const preset of ["top-down", "bottom", "bottom-center-angled"]) {
    const image = await fetch(
      `${serverUrl}?svg_type=3d&format=png&camera_preset=${preset}&png_width=96`,
      { method: "POST", body: JSON.stringify(input) },
    )
    expect(image.status).toBe(200)
    expect(image.headers.get("Content-Type")).toBe("image/png")
    await image.arrayBuffer()
  }
}, 30_000)
