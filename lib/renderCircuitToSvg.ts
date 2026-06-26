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

function findSimulationExperimentError(
  circuitJson: any[],
  simulationExperimentId?: string,
) {
  return circuitJson.find((element) => {
    if (!element || typeof element !== "object") return false

    const type =
      typeof element.type === "string"
        ? element.type
        : typeof element.error_type === "string"
          ? element.error_type
          : ""

    if (!type.startsWith("simulation_") || !type.endsWith("_error")) {
      return false
    }

    if (typeof element.message !== "string" || element.message.length === 0) {
      return false
    }

    if (!simulationExperimentId) {
      return true
    }

    return (
      element.simulation_experiment_id === simulationExperimentId ||
      element.simulation_experiment_id == null
    )
  })
}

export interface RenderOptions {
  backgroundColor?: string
  backgroundOpacity?: number
  zoomMultiplier?: number
  showSolderMask?: boolean
  showCourtyards?: boolean
  show_courtyards?: boolean
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
    showCourtyards,
  } = options

  const resolvedShowCourtyards = showCourtyards ?? options.show_courtyards

  const bgOpacity = Number.isFinite(backgroundOpacity) ? backgroundOpacity : 0.0
  const zoom = Number.isFinite(zoomMultiplier) ? zoomMultiplier : 1.2

  if (svgType === "assembly") {
    return convertCircuitJsonToAssemblySvg(circuitJson)
  }

  if (svgType === "pcb") {
    const pcbOptions = {
      showSolderMask,
      showCourtyards: resolvedShowCourtyards,
      show_courtyards: resolvedShowCourtyards,
    }

    const pcbSvg = await convertCircuitJsonToPcbSvg(circuitJson, pcbOptions)

    return pcbSvg
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

    try {
      return convertCircuitJsonToSchematicSimulationSvg({
        circuitJson,
        simulation_experiment_id: options.simulationExperimentId,
        simulation_transient_voltage_graph_ids:
          options.simulationTransientVoltageGraphIds,
        schematicHeightRatio: options.schematicHeightRatio,
      })
    } catch (err) {
      const simulationError = findSimulationExperimentError(
        circuitJson,
        options.simulationExperimentId,
      )
      if (simulationError) {
        throw new Error(
          `Simulation failed for "${options.simulationExperimentId}": ${simulationError.message}`,
        )
      }
      throw err
    }
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
