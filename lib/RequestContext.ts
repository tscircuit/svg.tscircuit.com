export interface RequestContext {
  url: URL
  host: string
  method: string
  body?: any
  compressedCode?: string
  fsMap?: Record<string, string>
  circuitJson?: any
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
}
