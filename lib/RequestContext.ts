export interface RequestContext {
  url: URL
  host: string
  method: string
  body?: any
  compressedCode?: string
  fsMapParam?: string
  fsMapFromPost?: Record<string, string>
  fsMapFromQuery?: Record<string, string>
  circuitJsonFromPost?: any
  entrypointFromQuery?: string
  entrypointFromPost?: string
  projectBaseUrlFromQuery?: string
  projectBaseUrlFromPost?: string
  mainComponentPathFromQuery?: string
  mainComponentPathFromPost?: string
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
  circuitJson?: any
}
