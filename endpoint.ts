import { getUncompressedSnippetString } from "@tscircuit/create-snippet-url"
import { CircuitRunner } from "@tscircuit/eval/eval"
import {
  convertCircuitJsonToPcbSvg,
  convertCircuitJsonToPinoutSvg,
  convertCircuitJsonToSchematicSvg,
} from "circuit-to-svg"
import { convertCircuitJsonToSimple3dSvg } from "circuit-json-to-simple-3d/dist/index.js"
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
        width: body.width,
        height: body.height,
        include_version: body.include_version,
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
      return errorResponse(err as Error)
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
      return errorResponse(err as Error)
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

  let svgContent: string
  try {
    if (svgType === "pcb") {
      svgContent = convertCircuitJsonToPcbSvg(circuitJson)
    } else if (svgType === "schematic") {
      svgContent = convertCircuitJsonToSchematicSvg(circuitJson)
    } else if (svgType === "pinout") {
      const widthParam =
        url.searchParams.get("width") ??
        (postBodyParams.width !== undefined
          ? String(postBodyParams.width)
          : undefined)
      const heightParam =
        url.searchParams.get("height") ??
        (postBodyParams.height !== undefined
          ? String(postBodyParams.height)
          : undefined)
      const options: {
        width?: number
        height?: number
        includeVersion?: boolean
      } = {}
      if (widthParam) {
        const parsedWidth = Number(widthParam)
        if (!Number.isNaN(parsedWidth)) options.width = parsedWidth
      }
      if (heightParam) {
        const parsedHeight = Number(heightParam)
        if (!Number.isNaN(parsedHeight)) options.height = parsedHeight
      }
      const includeVersionParam =
        url.searchParams.get("include_version") ??
        (postBodyParams.include_version !== undefined
          ? String(postBodyParams.include_version)
          : undefined)
      if (includeVersionParam) {
        options.includeVersion = includeVersionParam !== "false"
      }
      svgContent = convertCircuitJsonToPinoutSvg(circuitJson, options)
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
    return errorResponse(err as Error)
  }

  return new Response(svgContent, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
    },
  })
}

function errorResponse(err: Error) {
  return new Response(getErrorSvg(err.message), {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  })
}
