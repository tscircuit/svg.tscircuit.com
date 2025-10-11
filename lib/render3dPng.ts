import { convertCircuitJsonToGltf } from "circuit-json-to-gltf"
import { renderGLTFToPNGBufferFromGLBBuffer } from "poppygl"

export interface Render3dPngOptions {
  width?: number
  height?: number
}

export async function render3dPng(
  circuitJson: any,
  options: Render3dPngOptions = {},
): Promise<Uint8Array> {
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

  const pngWidth = options.width ?? 1024
  const pngHeight = options.height ?? pngWidth

  // Compute camera position relative to board size for overhead view
  let maxDim = 10 // Default size

  // Find board dimensions from circuit JSON
  const pcbBoard = circuitJson.find((el: any) => el.type === "pcb_board")
  if (pcbBoard?.width && pcbBoard?.height) {
    maxDim = Math.max(pcbBoard.width, pcbBoard.height)
  } else {
    const pcbComponent = circuitJson.find(
      (el: any) => el.type === "pcb_component" && (el.width || el.size?.width),
    )
    if (pcbComponent) {
      const width = pcbComponent.width || pcbComponent.size?.width || 0
      const height = pcbComponent.height || pcbComponent.size?.height || 0
      maxDim = Math.max(width, height, 5)
    }
  }

  const yHeight = maxDim * 1.4
  const xzOffset = maxDim * 0.75

  const camPos: [number, number, number] = [xzOffset, yHeight, xzOffset]
  const lookAt: [number, number, number] = [0, 0, 0]

  return await renderGLTFToPNGBufferFromGLBBuffer(glbBinary, {
    width: pngWidth,
    height: pngHeight,
    backgroundColor: null,
    camPos,
    lookAt,
  })
}
