import {
  convertCircuitJsonToAssemblySvg,
  convertCircuitJsonToPcbSvg,
  convertCircuitJsonToSchematicSvg,
  convertCircuitJsonToPinoutSvg,
  convertCircuitJsonToSchematicSimulationSvg,
} from "circuit-to-svg"
import { render3dPng } from "./render3dPng"
import { Buffer } from "node:buffer"
import * as vectorizerMod from "@neplex/vectorizer"

export interface RenderOptions {
  backgroundColor?: string
  backgroundOpacity?: number
  zoomMultiplier?: number
  showSolderMask?: boolean
  simulationExperimentId?: string
  simulationTransientVoltageGraphIds?: string[]
  schematicHeightRatio?: number
}

export type SvgRenderType =
  | "pcb"
  | "schematic"
  | "pinout"
  | "assembly"
  | "3d"
  | "schsim"

export async function renderCircuitToSvg(
  circuitJson: any,
  svgType: SvgRenderType,
  options: RenderOptions = {},
): Promise<string> {
  const {
    backgroundColor = "#fff",
    backgroundOpacity = 0.0,
    zoomMultiplier = 1.2,
    showSolderMask,
  } = options

  const bgOpacity = Number.isFinite(backgroundOpacity) ? backgroundOpacity : 0.0
  const zoom = Number.isFinite(zoomMultiplier) ? zoomMultiplier : 1.2

  if (svgType === "assembly") {
    return convertCircuitJsonToAssemblySvg(circuitJson)
  }

  if (svgType === "pcb") {
    const pcbOptions =
      typeof showSolderMask === "boolean" ? { showSolderMask } : undefined

    return convertCircuitJsonToPcbSvg(circuitJson, pcbOptions)
  }

  if (svgType === "schematic") {
    return convertCircuitJsonToSchematicSvg(circuitJson)
  }

  if (svgType === "schsim") {
    if (!options.simulationExperimentId) {
      throw new Error(
        "simulation_experiment_id is required when rendering schsim SVG output",
      )
    }

    return convertCircuitJsonToSchematicSimulationSvg({
      circuitJson,
      simulation_experiment_id: options.simulationExperimentId,
      simulation_transient_voltage_graph_ids:
        options.simulationTransientVoltageGraphIds,
      schematicHeightRatio: options.schematicHeightRatio,
    })
  }

  if (svgType === "pinout") {
    return convertCircuitJsonToPinoutSvg(circuitJson)
  }

  if (svgType === "3d") {
    const pngBinary = await render3dPng(circuitJson, {
      width: 1024,
      height: 1024,
      zoomMultiplier: zoom,
    })

    try {
      const vectorize = vectorizerMod.vectorize

      // Add missing required properties for vectorize config
      const svgResult = await vectorize(Buffer.from(pngBinary), {
        mode: 1,
        colorMode: 0,
        hierarchical: 0,
        filterSpeckle: 8,
        colorPrecision: 8,
        layerDifference: 8,
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
