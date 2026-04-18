import { Resvg } from "@resvg/resvg-js"
import { existsSync } from "node:fs"
import { join } from "node:path"

export type SvgToPngOptions = {
  width?: number
  height?: number
  density?: number
}

// NOTE: For Node.js, resvg uses fontFiles (array of paths), not fontBuffers!
function findFontPath(): string | null {
  const fontPaths = [
    // 1. Bundled DejaVu Sans (best - has full Unicode including Ω, µ, π, etc.)
    join(process.cwd(), "lib/fonts/DejaVuSans.ttf"),
    // 2. Next.js bundled Noto Sans (fallback - limited to Latin characters)
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

function normalizeSvgFonts(svg: string): string {
  return svg
    .replace(
      /font-family:\s*Arial,\s*serif;/g,
      'font-family: "DejaVu Sans", Arial, serif;',
    )
    .replace(
      /font-family:\s*'Inter',\s*'Helvetica Neue',\s*Arial,\s*sans-serif;/g,
      `font-family: "DejaVu Sans", 'Inter', 'Helvetica Neue', Arial, sans-serif;`,
    )
    .replace(
      /font-family:\s*sans-serif;/g,
      'font-family: "DejaVu Sans", sans-serif;',
    )
    .replace(
      /font-family="Arial, serif"/g,
      'font-family="DejaVu Sans, Arial, serif"',
    )
    .replace(
      /font-family="sans-serif"/g,
      'font-family="DejaVu Sans, sans-serif"',
    )
}

export async function svgToPng(
  svg: string,
  options: SvgToPngOptions,
): Promise<ArrayBuffer> {
  const normalizedSvg = normalizeSvgFonts(svg)
  // Resvg options
  const resvgOptions: any = {
    fitTo: {
      mode: "original",
    },
  }

  // Add font configuration
  if (fontPath) {
    resvgOptions.font = {
      fontFiles: [fontPath],
      loadSystemFonts: false, // Use only bundled font for consistent rendering
    }
  } else {
    console.warn("[svgToPng] No custom font found - may not render correctly!")
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
  const resvg = new Resvg(normalizedSvg, resvgOptions)
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()

  const arrayBuffer = new ArrayBuffer(pngBuffer.byteLength)
  new Uint8Array(arrayBuffer).set(pngBuffer)

  return arrayBuffer
}
