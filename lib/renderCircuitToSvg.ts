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

/**
 * When a SPICE simulation fails, @tscircuit/core records the real cause as a
 * `simulation_*_experiment_error` element (e.g. `simulation_unknown_experiment_error`)
 * and produces no transient graphs. circuit-to-svg only sees the missing graphs and
 * throws a generic "No ...graph elements found" message, swallowing the real cause.
 * This finds that recorded error so we can surface its message instead.
 */
function findSimulationExperimentError(
  circuitJson: any,
  simulationExperimentId: string,
): { message: string } | undefined {
  if (!Array.isArray(circuitJson)) return undefined

  const errors = circuitJson.filter(
    (el: any) =>
      el &&
      typeof el.type === "string" &&
      el.type.startsWith("simulation_") &&
      el.type.endsWith("_experiment_error") &&
      typeof el.message === "string",
  )

  if (errors.length === 0) return undefined

  // Prefer an error scoped to this experiment; fall back to one without an id.
  return (
    errors.find(
      (el: any) => el.simulation_experiment_id === simulationExperimentId,
    ) ?? errors.find((el: any) => el.simulation_experiment_id == null)
  )
}

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
