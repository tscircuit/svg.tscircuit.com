export interface RequestContext {
  url: URL
  host: string
  method: string
  body?: any
  compressedCode?: string
  fsMapParam?: string
  fsMap?: Record<string, string>
  circuitJson?: any
  entrypoint?: string
  projectBaseUrl?: string
  mainComponentPath?: string
  postBodyParams?: {
    background_color?: string
    background_opacity?: number
    zoom_multiplier?: number
    output_format?: string
    png_width?: number
    png_height?: number
    png_density?: number
  }
  outputFormat?: string
  svgType?: string
}
