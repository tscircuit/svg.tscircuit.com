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
import { convertCircuitJsonToSimple3dSvg } from "circuit-json-to-simple-3d/dist/index.js"
import { getHtmlForGeneratedUrlPage } from "./get-html-for-generated-url-page"
import { getIndexPageHtml } from "./get-index-page-html"
import { errorResponse } from "./lib/errorResponse"
import { getOutputFormat } from "./lib/getOutputFormat"
import { parsePositiveInt } from "./lib/parsePositiveInt"
import { circuitToVectorizedSvg } from "./lib/circuitToVectorizedSvg"
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
  const browser3d = url.searchParams.get("browser3d")

  if (!svgType || !["pcb", "schematic", "3d", "pinout"].includes(svgType)) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Invalid svg_type or view parameter",
      }),
      { status: 400 },
    )
  }

  let svgContent: string
  try {
    if (svgType === "pcb") {
      svgContent = convertCircuitJsonToPcbSvg(circuitJson)
    } else if (svgType === "schematic") {
      svgContent = convertCircuitJsonToSchematicSvg(circuitJson)
    } else if (svgType === "pinout") {
      svgContent = convertCircuitJsonToPinoutSvg(circuitJson)
    } else if (svgType === "3d" && browser3d) {
      svgContent = await circuitToVectorizedSvg(circuitJson)
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

      svgContent = await convertCircuitJsonToSimple3dSvg(circuitJson, {
        background: {
          color: backgroundColor,
          opacity: backgroundOpacity,
        },
        defaultZoomMultiplier: zoomMultiplier,
      })
    }
  } catch (err) {
    return await errorResponse(err as Error, outputFormat)
  }

  if (outputFormat === "png") {
    try {
      const pngBuffer = await svgToPng(svgContent, {
        density: parsePositiveInt(
          url.searchParams.get("png_density") ?? postBodyParams.png_density,
        ),
        width: parsePositiveInt(
          url.searchParams.get("png_width") ?? postBodyParams.png_width,
        ),
        height: parsePositiveInt(
          url.searchParams.get("png_height") ?? postBodyParams.png_height,
        ),
      })

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

  return new Response(svgContent, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
    },
  })
}
