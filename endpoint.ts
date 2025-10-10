import {
  getUncompressedSnippetString,
  getCompressedBase64SnippetString,
} from "@tscircuit/create-snippet-url"
import { CircuitRunner } from "@tscircuit/eval/eval"
import {
  convertCircuitJsonToPcbSvg,
  convertCircuitJsonToSchematicSvg,
  convertCircuitJsonToPinoutSvg,
} from "circuit-to-svg"
import { convertCircuitJsonToGltf } from "circuit-json-to-gltf"
import { renderGLTFToPNGBufferFromGLBBuffer } from "poppygl"
import { vectorizePngToSvg } from "./lib/vectorizePngToSvg"

const MAX_RENDER_CACHE_ENTRIES = 12
const glbCache = new Map<string, Uint8Array>()
const pngCache = new Map<string, Uint8Array>()

const getCachedBuffer = (cache: Map<string, Uint8Array>, key: string) => {
  const cached = cache.get(key)
  if (!cached) {
    return null
  }
  return new Uint8Array(cached)
}

const setCachedBuffer = (
  cache: Map<string, Uint8Array>,
  key: string,
  value: Uint8Array,
) => {
  if (cache.size >= MAX_RENDER_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value
    if (firstKey) {
      cache.delete(firstKey)
    }
  }
  cache.set(key, new Uint8Array(value))
}
import { getHtmlForGeneratedUrlPage } from "./get-html-for-generated-url-page"
import { getIndexPageHtml } from "./get-index-page-html"
import { errorResponse } from "./lib/errorResponse"
import { getOutputFormat } from "./lib/getOutputFormat"
import { parsePositiveInt } from "./lib/parsePositiveInt"
import { svgToPng } from "./lib/svgToPng"
import { decodeUrlHashToFsMap } from "./lib/fsMap"

export default async (req: Request) => {
  const url = new URL(req.url.replace("/api", "/"))
  const host = `${url.protocol}//${url.host}`

  if (url.pathname === "/health") {
    return new Response(JSON.stringify({ ok: true }))
  }

  if (url.pathname === "/generate_url") {
    const code = url.searchParams.get("code")
    if (!code) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "No code parameter provided for URL generation",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      )
    }
    return new Response(getHtmlForGeneratedUrlPage(code, host), {
      headers: { "Content-Type": "text/html" },
    })
  }

  if (url.pathname === "/generate_urls" && req.method === "POST") {
    try {
      const body = await req.json()
      const { fs_map, entrypoint } = body

      if (!fs_map) {
        return new Response(
          JSON.stringify({ ok: false, error: "No fsMap provided" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        )
      }

      return new Response(
        getHtmlForGeneratedUrlPage({ fsMap: fs_map, entrypoint }, host),
        {
          headers: { "Content-Type": "text/html" },
        },
      )
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, error: (err as Error).message }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      )
    }
  }

  const compressedCode = url.searchParams.get("code")
  let circuitJsonFromPost: any = null
  let fsMapFromPost: any = null
  let entrypointFromPost: string | null = null
  let postBodyParams: any = {}

  if (req.method === "POST") {
    try {
      const body = await req.json()
      if (body.circuit_json) {
        circuitJsonFromPost = body.circuit_json
      }
      if (body.fsMap) {
        fsMapFromPost = body.fsMap
        entrypointFromPost = body.entrypoint || null
      }
      postBodyParams = {
        background_color: body.background_color,
        background_opacity: body.background_opacity,
        zoom_multiplier: body.zoom_multiplier,
        output_format: body.output_format || body.format,
        png_width: body.png_width,
        png_height: body.png_height,
        png_density: body.png_density,
      }
    } catch (err) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Invalid JSON in request body",
        }),
        { status: 400 },
      )
    }
  }

  if (
    url.pathname === "/" &&
    req.method === "GET" &&
    !compressedCode &&
    !circuitJsonFromPost &&
    !fsMapFromPost
  ) {
    return new Response(getIndexPageHtml(), {
      headers: { "Content-Type": "text/html" },
    })
  }

  const outputFormat = getOutputFormat(url, postBodyParams)
  if (!outputFormat) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Invalid format parameter",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )
  }

  if (!compressedCode && !circuitJsonFromPost && !fsMapFromPost) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          "No code parameter (GET/POST), circuit_json (POST), or fsMap (POST) provided",
      }),
      { status: 400 },
    )
  }

  let circuitJson: any
  if (circuitJsonFromPost) {
    circuitJson = circuitJsonFromPost
  } else if (fsMapFromPost) {
    const worker = new CircuitRunner()
    try {
      await worker.executeWithFsMap({
        fsMap: fsMapFromPost,
        entrypoint: entrypointFromPost || "index.tsx",
      })
      await worker.renderUntilSettled()
      circuitJson = await worker.getCircuitJson()
    } catch (err) {
      return await errorResponse(err as Error, outputFormat)
    }
  } else if (compressedCode) {
    const worker = new CircuitRunner()
    try {
      const decodedFsMap = decodeUrlHashToFsMap(compressedCode)

      if (decodedFsMap) {
        await worker.executeWithFsMap({
          fsMap: decodedFsMap,
        })
      } else {
        const userCode = getUncompressedSnippetString(compressedCode)
        await worker.executeWithFsMap({
          fsMap: {
            "index.tsx": userCode,
          },
        })
      }

      await worker.renderUntilSettled()
      circuitJson = await worker.getCircuitJson()
    } catch (err) {
      return await errorResponse(err as Error, outputFormat)
    }
  }

  // Check for both svg_type and view parameters, with svg_type taking precedence
  const svgType =
    url.searchParams.get("svg_type") || url.searchParams.get("view")
  if (!svgType || !["pcb", "schematic", "3d", "pinout"].includes(svgType)) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Invalid svg_type or view parameter",
      }),
      { status: 400 },
    )
  }

  const pngDensityParam = parsePositiveInt(
    url.searchParams.get("png_density") ?? postBodyParams.png_density,
  )
  const pngWidthParam = parsePositiveInt(
    url.searchParams.get("png_width") ?? postBodyParams.png_width,
  )
  const pngHeightParam = parsePositiveInt(
    url.searchParams.get("png_height") ?? postBodyParams.png_height,
  )

  let svgContent: string | null = null
  let preRenderedPngBuffer: Uint8Array | null = null
  try {
    if (svgType === "pcb") {
      svgContent = convertCircuitJsonToPcbSvg(circuitJson)
    } else if (svgType === "schematic") {
      svgContent = convertCircuitJsonToSchematicSvg(circuitJson)
    } else if (svgType === "pinout") {
      svgContent = convertCircuitJsonToPinoutSvg(circuitJson)
    } else {
      // Extract 3D SVG parameters from URL and POST body (URL takes precedence)
      const backgroundColor =
        url.searchParams.get("background_color") ||
        postBodyParams.background_color ||
        "#fff"
      const backgroundOpacity = parseFloat(
        url.searchParams.get("background_opacity") ||
          postBodyParams.background_opacity ||
          "0.0",
      )
      const zoomMultiplier = parseFloat(
        url.searchParams.get("zoom_multiplier") ||
          postBodyParams.zoom_multiplier ||
          "1.2",
      )

      const normalizeColor = (
        color: string,
      ): [number, number, number] | null => {
        const hexMatch = color.match(/^#([\da-f]{3}|[\da-f]{6})$/i)
        if (!hexMatch) {
          return null
        }

        const hex = hexMatch[1]
        const expand = hex.length === 3
        const r = parseInt(expand ? hex[0].repeat(2) : hex.slice(0, 2), 16)
        const g = parseInt(expand ? hex[1].repeat(2) : hex.slice(2, 4), 16)
        const b = parseInt(expand ? hex[2].repeat(2) : hex.slice(4, 6), 16)
        return [r / 255, g / 255, b / 255]
      }

      const circuitCacheKey = JSON.stringify(circuitJson)
      const glbCacheKey = `${circuitCacheKey}|glb`
      let glbBinary: Uint8Array | null = getCachedBuffer(glbCache, glbCacheKey)

      if (!glbBinary) {
        const glbResult = (await convertCircuitJsonToGltf(circuitJson, {
          format: "glb",
        })) as unknown

        let computedBinary: Uint8Array
        if (glbResult instanceof Uint8Array) {
          computedBinary = new Uint8Array(glbResult)
        } else if (glbResult instanceof ArrayBuffer) {
          computedBinary = new Uint8Array(glbResult)
        } else if (ArrayBuffer.isView(glbResult)) {
          const view = glbResult as ArrayBufferView
          computedBinary = new Uint8Array(
            view.buffer.slice(
              view.byteOffset,
              view.byteOffset + view.byteLength,
            ),
          )
        } else {
          throw new Error("GLB conversion did not return binary data")
        }

        setCachedBuffer(glbCache, glbCacheKey, computedBinary)
        glbBinary = computedBinary
      }

      if (!glbBinary) {
        throw new Error("Unable to prepare GLB binary for rendering")
      }

      const defaultPngSize = outputFormat === "png" ? 1024 : 512
      const pngWidth = pngWidthParam ?? defaultPngSize
      const pngHeight = pngHeightParam ?? pngWidth

      // Compute camera position relative to board size for overhead view
      // Y is "up" axis in poppygl's coordinate system
      let maxDim = 10 // Default size

      // Find board dimensions from circuit JSON
      const pcbBoard = circuitJson.find((el: any) => el.type === "pcb_board")
      if (pcbBoard?.width && pcbBoard?.height) {
        // Use PCB board dimensions
        maxDim = Math.max(pcbBoard.width, pcbBoard.height)
      } else {
        // No board found, try to find first pcb_component with size
        const pcbComponent = circuitJson.find(
          (el: any) =>
            el.type === "pcb_component" && (el.width || el.size?.width),
        )
        if (pcbComponent) {
          const width = pcbComponent.width || pcbComponent.size?.width || 0
          const height = pcbComponent.height || pcbComponent.size?.height || 0
          maxDim = Math.max(width, height, 5) // Minimum of 5mm
        }
      }

      const normalizedZoom = Number.isFinite(zoomMultiplier)
        ? Math.max(0.1, zoomMultiplier)
        : 1.2
      const zoomScale = normalizedZoom <= 0 ? 1 : 1 / normalizedZoom

      // Position camera for overhead view with slight angle
      // Y is up, so make Y height proportionally larger for overhead
      // X and Z give us the angled perspective
      const yHeight = maxDim * 1.4 * zoomScale
      const xzOffset = maxDim * 0.75 * zoomScale

      const camPos: [number, number, number] = [xzOffset, yHeight, xzOffset]
      const lookAt: [number, number, number] = [0, 0, 0]

      const poppyBackground =
        backgroundOpacity >= 0.999
          ? (normalizeColor(backgroundColor) ?? null)
          : null

      const pngCacheKey = `${circuitCacheKey}|${pngWidth}|${pngHeight}|${normalizedZoom.toFixed(
        3,
      )}`
      const cachedPng = getCachedBuffer(pngCache, pngCacheKey)

      if (cachedPng) {
        preRenderedPngBuffer = cachedPng
      } else {
        const renderedPng = await renderGLTFToPNGBufferFromGLBBuffer(
          glbBinary,
          {
            width: pngWidth,
            height: pngHeight,
            backgroundColor: poppyBackground,
            camPos,
            lookAt,
          },
        )

        preRenderedPngBuffer = new Uint8Array(renderedPng)
        setCachedBuffer(pngCache, pngCacheKey, preRenderedPngBuffer)
      }

      if (outputFormat !== "png") {
        svgContent = await vectorizePngToSvg(preRenderedPngBuffer, {
          backgroundColor,
          backgroundOpacity,
          paletteSize: 12,
        })
      }
    }
  } catch (err) {
    return await errorResponse(err as Error, outputFormat)
  }

  if (outputFormat === "png") {
    try {
      let pngBuffer: Uint8Array | ArrayBuffer
      if (preRenderedPngBuffer) {
        pngBuffer = preRenderedPngBuffer
      } else {
        if (svgContent == null) {
          throw new Error("No SVG content available for PNG conversion")
        }

        pngBuffer = await svgToPng(svgContent, {
          density: pngDensityParam,
          width: pngWidthParam,
          height: pngHeightParam,
        })
      }

      return new Response(pngBuffer, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control":
            "public, max-age=86400, s-maxage=31536000, immutable",
        },
      })
    } catch (err) {
      return await errorResponse(err as Error, outputFormat)
    }
  }

  if (svgContent == null) {
    throw new Error("No SVG content generated")
  }

  return new Response(svgContent, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
    },
  })
}
