import {
  renderCircuitJsonTo3dPng,
} from "circuit-json-to-3d-png"

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

  return renderCircuitJsonTo3dPng(circuitJson, {
    width: pngWidth,
    height: pngHeight,
    backgroundColor: options.backgroundColor ?? null,
    showInfiniteGrid: options.showInfiniteGrid,
    supersampling: 2,
  })
}
