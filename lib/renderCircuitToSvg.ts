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
  } = options

  const bgOpacity = Number.isFinite(backgroundOpacity) ? backgroundOpacity : 0.0
  const zoom = Number.isFinite(zoomMultiplier) ? zoomMultiplier : 1.2

  if (svgType === "assembly") {
    return convertCircuitJsonToAssemblySvg(circuitJson)
  }

  if (svgType === "pcb") {
    return convertCircuitJsonToPcbSvg(circuitJson)
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
      const vectorize = ((vectorizerMod as any).vectorize ||
        (vectorizerMod as any).default) as
        | ((bytes: Uint8Array, opts?: any) => Promise<string> | string)
        | undefined

      if (!vectorize) {
        throw new Error("Vectorizer function not found in @neplex/vectorizer")
      }

      const svgResult = await vectorize(pngBinary)

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
