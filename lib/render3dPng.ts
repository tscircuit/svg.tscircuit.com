import {
  convertCircuitJsonTo3dGlb,
  renderCircuitJsonTo3dPng,
} from "circuit-json-to-3d-png"
import { renderGLTFToPNGFromGLB } from "poppygl"

export interface Render3dPngOptions {
  width?: number
  height?: number
  zoomMultiplier?: number
  showInfiniteGrid?: boolean
  backgroundColor?: string
}

export async function render3dPng(
  circuitJson: any,
  options: Render3dPngOptions = {},
): Promise<Uint8Array> {
  const pngWidth = options.width ?? 1024
  const pngHeight = options.height ?? pngWidth

  const hasAssembly = circuitJson.some(
    (element: any) =>
      element.type === "cad_cable" ||
      (element.type === "source_component" &&
        ["motor", "printedpart", "subassembly"].includes(element.ftype)),
  )
  if (hasAssembly) {
    // Fit the generated meshes, including off-board parts and cables. The
    // board-only camera used below excludes those assembly extents.
    const glb = await convertCircuitJsonTo3dGlb(circuitJson)
    return renderGLTFToPNGFromGLB(glb, {
      width: pngWidth,
      height: pngHeight,
      backgroundColor: options.backgroundColor ?? null,
      supersampling: 2,
      grid: options.showInfiniteGrid
        ? {
            infiniteGrid: true,
            gridColor: [0.9, 0.9, 0.9],
            sectionColor: [0.7, 0.7, 0.9],
            offset: { y: 0 },
          }
        : false,
    })
  }

  return renderCircuitJsonTo3dPng(circuitJson, {
    width: pngWidth,
    height: pngHeight,
    backgroundColor: options.backgroundColor ?? null,
    showInfiniteGrid: options.showInfiniteGrid,
    supersampling: 2,
  })
}
