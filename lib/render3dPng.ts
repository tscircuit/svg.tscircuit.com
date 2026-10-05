import {
  convertCircuitJsonTo3dGlb,
  getDefaultCameraForCircuitJson,
} from "circuit-json-to-3d-png"
import { renderGLTFToPNGFromGLB } from "poppygl"

export interface Render3dPngOptions {
  width?: number
  height?: number
  zoomMultiplier?: number
  showInfiniteGrid?: boolean
  backgroundColor?: string
  realistic?: boolean
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

  // The wrapper's PNG renderer selects options and drops `realistic`. Reuse
  // its model conversion/camera helpers and pass render options to PoppyGL.
  const [glb, camera] = await Promise.all([
    convertCircuitJsonTo3dGlb(circuitJson),
    // Fit assembly meshes, including off-board parts and cables.
    hasAssembly
      ? Promise.resolve({})
      : getDefaultCameraForCircuitJson(circuitJson),
  ])

  return renderGLTFToPNGFromGLB(glb, {
    ...camera,
    width: pngWidth,
    height: pngHeight,
    backgroundColor: options.backgroundColor ?? null,
    supersampling: 2,
    realistic: options.realistic,
    ...(options.showInfiniteGrid
      ? {
          grid: {
            infiniteGrid: true,
            gridColor: [0.9, 0.9, 0.9] as const,
            sectionColor: [0.7, 0.7, 0.9] as const,
            offset: { y: 0 },
          },
        }
      : {}),
  })
}
