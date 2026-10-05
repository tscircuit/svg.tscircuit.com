export type SvgToPngOptions = {
  width?: number
  height?: number
  density?: number
}

// Width takes precedence over height, which takes precedence over density.
// Keep native Resvg and the Worker WASM renderer's sizing identical.
export function getPngFitTo(options: SvgToPngOptions) {
  if (options.width) return { mode: "width" as const, value: options.width }
  if (options.height) return { mode: "height" as const, value: options.height }
  if (options.density)
    return { mode: "zoom" as const, value: options.density / 72 }
  return { mode: "original" as const }
}
