import { Buffer } from "node:buffer"
import { getUncompressedSnippetString } from "@tscircuit/create-snippet-url"
import { CircuitRunner } from "@tscircuit/eval/eval"
import {
  convertCircuitJsonToPcbSvg,
  convertCircuitJsonToSchematicSvg,
} from "circuit-to-svg"
import { convertCircuitJsonToSimple3dSvg } from "circuit-json-to-simple-3d/dist/index.js"
import sharp, { type SharpOptions } from "sharp"
import { getHtmlForGeneratedUrlPage } from "./get-html-for-generated-url-page"
import { getErrorSvg } from "./getErrorSvg"
import { getIndexPageHtml } from "./get-index-page-html"

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

  const compressedCode = url.searchParams.get("code")
  let circuitJsonFromPost: any = null
  let postBodyParams: any = {}

  // Handle POST request with circuit_json in body
  if (req.method === "POST") {
    try {
      const body = await req.json()
      if (body.circuit_json) {
        circuitJsonFromPost = body.circuit_json
      }
      // Extract 3D SVG parameters from POST body
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

  // Show index page only for GET requests with no parameters
  if (
    url.pathname === "/" &&
    req.method === "GET" &&
    !compressedCode &&
    !circuitJsonFromPost
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

  if (!compressedCode && !circuitJsonFromPost) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          "No code parameter (GET/POST) or circuit_json (POST only) provided",
      }),
      { status: 400 },
    )
  }

  let circuitJson: any
  if (circuitJsonFromPost) {
    circuitJson = circuitJsonFromPost
  } else if (compressedCode) {
    let userCode: string
    try {
      userCode = getUncompressedSnippetString(compressedCode)
    } catch (err) {
      return await errorResponse(err as Error, outputFormat)
    }

    const worker = new CircuitRunner()

    try {
      await worker.executeWithFsMap({
        fsMap: {
          "entrypoint.tsx": `
            import * as UserComponents from "./UserCode.tsx";

            const ComponentToRender = Object.entries(UserComponents)
              .filter(([name]) => !name.startsWith("use"))
              .map(([_, component]) => component)[0] || (() => null);

            circuit.add(
              <ComponentToRender />
            );
          `,
          "UserCode.tsx": userCode,
        },
        entrypoint: "entrypoint.tsx",
      })

      await worker.renderUntilSettled()
      circuitJson = await worker.getCircuitJson()
    } catch (err) {
      return await errorResponse(err as Error, outputFormat)
    }
  }

  // Check for both svg_type and view parameters, with svg_type taking precedence
  const svgType =
    url.searchParams.get("svg_type") || url.searchParams.get("view")
  if (!svgType || !["pcb", "schematic", "3d"].includes(svgType)) {
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

async function errorResponse(err: Error, format: "svg" | "png") {
  const errorSvg = getErrorSvg(err.message)

  if (format === "png") {
    try {
      const pngBuffer = await svgToPng(errorSvg, {})

      return new Response(pngBuffer, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
        },
      })
    } catch (_) {
      return new Response(
        JSON.stringify({ ok: false, error: err.message }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      )
    }
  }

  return new Response(errorSvg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  })
}

function getOutputFormat(
  url: URL,
  postBodyParams: Record<string, any>,
): "svg" | "png" | null {
  const rawFormat =
    url.searchParams.get("format") ||
    url.searchParams.get("output") ||
    url.searchParams.get("response_format") ||
    postBodyParams.output_format ||
    "svg"

  if (typeof rawFormat !== "string") {
    return null
  }

  const normalized = rawFormat.toLowerCase()

  if (normalized === "svg") {
    return "svg"
  }

  if (normalized === "png") {
    return "png"
  }

  return null
}

function parsePositiveInt(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const intValue = Math.trunc(value)
    return intValue > 0 ? intValue : undefined
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return undefined
}

async function svgToPng(
  svg: string,
  options: { width?: number; height?: number; density?: number },
): Promise<ArrayBuffer> {
  const sharpOptions: SharpOptions = {}

  if (options.density) {
    sharpOptions.density = options.density
  }

  let image = sharp(Buffer.from(svg), sharpOptions)

  if (options.width || options.height) {
    image = image.resize({
      width: options.width,
      height: options.height,
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
  }

  const nodeBuffer = await image
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
    })
    .toBuffer()

  const arrayBuffer = new ArrayBuffer(nodeBuffer.byteLength)
  new Uint8Array(arrayBuffer).set(nodeBuffer)

  return arrayBuffer
}
