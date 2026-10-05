import { Buffer } from "node:buffer"
import * as vectorizerMod from "@neplex/vectorizer"
import type { CircuitJson } from "circuit-json"
import {
  renderCircuitTo2dSvg,
  type RenderOptions,
  type SvgRenderType,
} from "../shared/render-2d"
export type { RenderOptions, SvgRenderType } from "../shared/render-2d"
import { render3dPng } from "./render3dPng"

export async function renderCircuitToSvg(
  circuitJson: CircuitJson,
  svgType: SvgRenderType,
  options: RenderOptions = {},
): Promise<string> {
  if (svgType !== "3d")
    return renderCircuitTo2dSvg(circuitJson, svgType, options)
  const {
    backgroundColor = "#fff",
    backgroundOpacity = 0,
    zoomMultiplier = 1.2,
  } = options
  const bgOpacity = Number.isFinite(backgroundOpacity) ? backgroundOpacity : 0
  const zoom = Number.isFinite(zoomMultiplier) ? zoomMultiplier : 1.2

  if (svgType === "3d") {
    const pngBinary = await render3dPng(circuitJson, {
      width: 1024,
      height: 1024,
      zoomMultiplier: zoom,
      realistic: options.realistic,
    })

    try {
      const vectorize = vectorizerMod.vectorize

      // Add missing required properties for vectorize config
      const svgResult = await vectorize(Buffer.from(pngBinary), {
        mode: 1,
        colorMode: 0,
        hierarchical: 0,
        // Fine-pitch leads are only a few pixels wide in 3D previews.
        // Preserve those clusters instead of filtering them as noise.
        filterSpeckle: 1,
        colorPrecision: 8,
        layerDifference: 4,
        maxIterations: 100,
        // Set required threshold properties with reasonable defaults
        cornerThreshold: 60,
        lengthThreshold: 4,
        spliceThreshold: 30,
      })

      if (bgOpacity > 0) {
        return svgResult.replace(
          /<svg([^>]*)>/,
          `<svg$1><rect width="100%" height="100%" fill="${backgroundColor}" fill-opacity="${bgOpacity}"/>`,
        )
      }
      return svgResult
    } catch {
      const base64 = Buffer.from(pngBinary).toString("base64")
      return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><image href="data:image/png;base64,${base64}" width="1024" height="1024"/></svg>`
    }
  }

  throw new Error(`Invalid SVG type: ${svgType}`)
}
