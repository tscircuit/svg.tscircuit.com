import type { CircuitJson } from "circuit-json"
import type { PcbViewBox } from "./parsePcbViewBox"

export interface RequestContext {
  url: URL
  host: string
  method: string
  compressedCode?: string
  fsMap?: Record<string, string>
  circuitJson?: CircuitJson
  entrypoint?: string
  projectBaseUrl?: string
  mainComponentPath?: string
  backgroundColor?: string
  backgroundOpacity?: number
  zoomMultiplier?: number
  pngWidth?: number
  pngHeight?: number
  pngDensity?: number
  outputFormat?: string
  svgType?: string
  showSolderMask?: boolean
  showCourtyards?: boolean
  showInfiniteGrid?: boolean
  pcbViewBox?: PcbViewBox
  simulationExperimentId?: string
  simulationExperimentName?: string
  simulationTransientVoltageGraphIds?: string[]
  schematicHeightRatio?: number
  requestBody?: unknown
}
