import {
  convertCircuitJsonToAssemblySvg,
  convertCircuitJsonToPcbSvg,
  convertCircuitJsonToSchematicSvg,
  convertCircuitJsonToPinoutSvg,
  convertCircuitJsonToSchematicSimulationSvg,
} from "circuit-to-svg"
import { convertCircuitJsonToSimple3dSvg } from "circuit-json-to-simple-3d/dist/index.js"

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
