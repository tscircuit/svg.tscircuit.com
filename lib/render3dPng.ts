import { create3dGlb } from "./create3dGlb"
import type { AssemblyExplosionOptions } from "circuit-json-to-gltf"
import { getAssemblyCamera } from "./getAssemblyCamera"
import { getDefaultCameraForCircuitJson } from "circuit-json-to-3d-png"
import { renderGLTFToPNGFromGLB } from "poppygl"
import { presetCamera } from "./cameraPreset"

export interface Render3dPngOptions {
  explosion?: AssemblyExplosionOptions
  width?: number
  height?: number
  zoomMultiplier?: number
  showInfiniteGrid?: boolean
  backgroundColor?: string
  cameraPreset?: string
  onGlb?: (glb: Uint8Array) => void
  realistic?: boolean
}

export async function render3dPng(
  circuitJson: any,
  options: Render3dPngOptions = {},
): Promise<Uint8Array> {
  const pngWidth = options.width ?? 1024
  const pngHeight = options.height ?? pngWidth

  const hasAssembly =
    Boolean(options.explosion) ||
    circuitJson.some(
      (element: any) =>
        element.type === "cad_cable" ||
        (element.type === "cad_component" && !element.pcb_component_id) ||
        (element.type === "source_component" &&
          ["motor", "printedpart", "subassembly"].includes(element.ftype)),
    )

  // The wrapper's PNG renderer selects options and drops `realistic`. Reuse
  // its model conversion/camera helpers and pass render options to PoppyGL.
  const [glb, camera] = await Promise.all([
    create3dGlb(circuitJson, options.explosion),
    // Fit assembly meshes, including off-board parts and cables.
    hasAssembly
      ? Promise.resolve({})
      : getDefaultCameraForCircuitJson(circuitJson),
  ])

  options.onGlb?.(glb)
  return renderGLTFToPNGFromGLB(glb, {
    ...(hasAssembly
      ? getAssemblyCamera(glb, pngWidth / pngHeight, options.cameraPreset)
      : presetCamera(options.cameraPreset, camera)),
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
