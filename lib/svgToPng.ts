import { Resvg } from "@resvg/resvg-js"
import { existsSync } from "node:fs"
import { join } from "node:path"

export type SvgToPngOptions = {
  width?: number
  height?: number
  density?: number
}

// Find font file path at module level with multiple fallback strategies
// NOTE: For Node.js, resvg uses fontFiles (array of paths), not fontBuffers!
function findFontPath(): string | null {
  const fontPaths = [
    join(
      process.cwd(),
      "node_modules/next/dist/compiled/@vercel/og/noto-sans-v27-latin-regular.ttf",
    ),
  ]

  for (const fontPath of fontPaths) {
    try {
      if (existsSync(fontPath)) {
        console.log(`[svgToPng] Found font at: ${fontPath}`)
        return fontPath
      }
    } catch (error) {
      console.warn(`[svgToPng] Failed to check font at ${fontPath}:`, error)
    }
  }

  console.error("[svgToPng] Could not find any font file!")
  return null
}

const fontPath = findFontPath()

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

  // Add font configuration
  // NOTE: Node.js version of resvg uses fontFiles (paths), not fontBuffers (binary)!
  resvgOptions.font = {
    loadSystemFonts: true, // Enable system fonts (Arial, sans-serif, etc.)
  }

  // Add custom font if available for fallback
  if (fontPath) {
    resvgOptions.font.fontFiles = [fontPath]
  } else {
    console.warn("[svgToPng] No custom font found - using system fonts only")
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

  const arrayBuffer = new ArrayBuffer(pngBuffer.byteLength)
  new Uint8Array(arrayBuffer).set(pngBuffer)

  return arrayBuffer
}
