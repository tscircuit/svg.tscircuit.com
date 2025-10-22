import { Resvg } from "@resvg/resvg-js"
import { readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

export type SvgToPngOptions = {
  width?: number
  height?: number
  density?: number
}

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load font once at module level with multiple fallback strategies
function loadFont(): Buffer | null {
  const fontPaths = [
    // 1. Bundled font in lib/fonts (best for Vercel)
    join(__dirname, "fonts", "noto-sans-v27-latin-regular.ttf"),
    // 2. Node modules path (for local development)
    join(
      process.cwd(),
      "node_modules/next/dist/compiled/@vercel/og/noto-sans-v27-latin-regular.ttf",
    ),
    // 3. Relative from lib directory
    join(__dirname, "..", "node_modules/next/dist/compiled/@vercel/og/noto-sans-v27-latin-regular.ttf"),
  ]

  for (const fontPath of fontPaths) {
    try {
      if (existsSync(fontPath)) {
        console.log(`[svgToPng] Loading font from: ${fontPath}`)
        return readFileSync(fontPath)
      }
    } catch (error) {
      console.warn(`[svgToPng] Failed to load font from ${fontPath}:`, error)
    }
  }

  console.error("[svgToPng] Could not load any font file!")
  return null
}

const fontBuffer = loadFont()

export async function svgToPng(
  svg: string,
  options: SvgToPngOptions,
): Promise<ArrayBuffer> {
  // Preprocess SVG to replace font families with "Noto Sans"
  // This is necessary because resvg doesn't automatically map generic font families
  // (like "Arial" or "sans-serif") to loaded fonts
  let processedSvg = svg
  if (fontBuffer) {
    // Replace common font-family declarations with Noto Sans
    processedSvg = processedSvg
      .replace(/font-family="[^"]*"/g, 'font-family="Noto Sans"')
      .replace(/font-family:\s*[^;"}]+/g, 'font-family: Noto Sans')
      .replace(/style="font-family:\s*sans-serif;/g, 'style="font-family: Noto Sans;')
  }

  // Resvg options
  const resvgOptions: any = {
    fitTo: {
      mode: "original",
    },
  }

  // Add font configuration if font was loaded successfully
  if (fontBuffer) {
    resvgOptions.font = {
      fontBuffers: [fontBuffer],
    }
  } else {
    console.warn("[svgToPng] Rendering without fonts - text may not appear!")
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
  const resvg = new Resvg(processedSvg, resvgOptions)
  const pngData = resvg.render()
  const pngBuffer = pngData.asPng()

  // Convert to ArrayBuffer
  const arrayBuffer = new ArrayBuffer(pngBuffer.byteLength)
  new Uint8Array(arrayBuffer).set(pngBuffer)

  return arrayBuffer
}
