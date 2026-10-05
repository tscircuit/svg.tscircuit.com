import type { CircuitJson } from "circuit-json"
import {
  convertCircuitJsonToAssemblySvg,
  convertCircuitJsonToPcbSvg,
  convertCircuitJsonToPinoutSvg,
  convertCircuitJsonToSchematicSimulationSvg,
  convertCircuitJsonToSimulationGraphSvg,
  convertCircuitJsonToStackedSchematicSheetsSvg,
} from "circuit-to-svg"
import type { PcbViewBox } from "../lib/parsePcbViewBox"

export interface RenderOptions {
  backgroundColor?: string
  backgroundOpacity?: number
  zoomMultiplier?: number
  showSolderMask?: boolean
  showCourtyards?: boolean
  show_courtyards?: boolean
  showDebugObjects?: boolean
  realistic?: boolean
  pcbViewBox?: PcbViewBox
  simulationExperimentId?: string
  simulationTransientVoltageGraphIds?: string[]
  simulationTransientCurrentGraphIds?: string[]
  schematicHeightRatio?: number
}

export type SvgRenderType =
  | "pcb"
  | "schematic"
  | "pinout"
  | "assembly"
  | "3d"
  | "schsim"
  | "sim"

export async function renderCircuitTo2dSvg(
  circuitJson: CircuitJson,
  svgType: Exclude<SvgRenderType, "3d">,
  options: RenderOptions = {},
): Promise<string> {
  const { showSolderMask, showDebugObjects, pcbViewBox } = options
  const resolvedShowCourtyards =
    options.showCourtyards ?? options.show_courtyards
  if (svgType === "assembly") {
    return convertCircuitJsonToAssemblySvg(circuitJson)
  }

  if (svgType === "pcb") {
    const pcbOptions = {
      showSolderMask,
      showCourtyards: resolvedShowCourtyards,
      show_courtyards: resolvedShowCourtyards,
      showDebugObjects,
      viewport: pcbViewBox,
    }

    const pcbSvg = await convertCircuitJsonToPcbSvg(circuitJson, pcbOptions)

    return pcbSvg
  }

  if (svgType === "schematic") {
    return convertCircuitJsonToStackedSchematicSheetsSvg(circuitJson)
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
      simulation_transient_current_graph_ids:
        options.simulationTransientCurrentGraphIds,
      simulation_transient_voltage_graph_ids:
        options.simulationTransientVoltageGraphIds,
      schematicHeightRatio: options.schematicHeightRatio,
    })
  }

  if (svgType === "sim") {
    if (!options.simulationExperimentId) {
      throw new Error(
        "simulation_experiment_id is required when rendering sim SVG output",
      )
    }

    return convertCircuitJsonToSimulationGraphSvg({
      circuitJson,
      simulation_experiment_id: options.simulationExperimentId,
      simulation_transient_current_graph_ids:
        options.simulationTransientCurrentGraphIds,
      simulation_transient_voltage_graph_ids:
        options.simulationTransientVoltageGraphIds,
    })
  }

  if (svgType === "pinout") {
    return convertCircuitJsonToPinoutSvg(circuitJson)
  }

  throw new Error(`Invalid SVG type: ${svgType}`)
}
