import {
  convertCircuitJsonToPcbSvg,
  convertCircuitJsonToSchematicSvg,
  convertCircuitJsonToPinoutSvg,
} from "circuit-to-svg"
import { convertCircuitJsonToSimple3dSvg } from "circuit-json-to-simple-3d/dist/index.js"

export interface RenderOptions {
  backgroundColor?: string
  backgroundOpacity?: number
  zoomMultiplier?: number
}

export async function renderCircuitToSvg(
  circuitJson: any,
  svgType: "pcb" | "schematic" | "pinout" | "3d",
  options: RenderOptions = {},
): Promise<string> {
  const {
    backgroundColor = "#fff",
    backgroundOpacity = 0.0,
    zoomMultiplier = 1.2,
  } = options

  if (svgType === "pcb") {
    return convertCircuitJsonToPcbSvg(circuitJson)
  }

  if (svgType === "schematic") {
    return convertCircuitJsonToSchematicSvg(circuitJson)
  }

  if (svgType === "pinout") {
    return convertCircuitJsonToPinoutSvg(circuitJson)
  }

  if (svgType === "3d") {
    return await convertCircuitJsonToSimple3dSvg(circuitJson, {
      background: {
        color: backgroundColor,
        opacity: backgroundOpacity,
      },
      defaultZoomMultiplier: zoomMultiplier,
    })
  }

  throw new Error(`Invalid SVG type: ${svgType}`)
}
