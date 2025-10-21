import { Resvg } from "@resvg/resvg-js"

export type SvgToPngOptions = {
  width?: number
  height?: number
  density?: number
}

export async function svgToPng(
  svg: string,
  options: SvgToPngOptions,
): Promise<ArrayBuffer> {
  // Resvg options
  const resvgOptions: any = {
    fitTo: {
      mode: "original",
    },
  }

  // Apply density scaling if specified
  if (options.density) {
    const scaleFactor = options.density / 72 // Convert DPI to scale factor (72 DPI is default)
    resvgOptions.fitTo = {
      mode: "zoom",
      value: scaleFactor,
    }
  }

  // Apply width/height if specified
  if (options.width || options.height) {
    if (options.width && options.height) {
      resvgOptions.fitTo = {
        mode: "width",
        value: options.width,
      }
    } else if (options.width) {
      resvgOptions.fitTo = {
        mode: "width",
        value: options.width,
      }
    } else if (options.height) {
      resvgOptions.fitTo = {
        mode: "height",
        value: options.height,
      }
    }
  }

  // Render SVG to PNG using Resvg
  const resvg = new Resvg(svg, resvgOptions)
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()

  // Convert to ArrayBuffer
  const arrayBuffer = new ArrayBuffer(pngBuffer.byteLength)
  new Uint8Array(arrayBuffer).set(pngBuffer)

  return arrayBuffer
}
