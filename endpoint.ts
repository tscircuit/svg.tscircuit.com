import { getIndexPageHtml } from "./get-index-page-html"
import { getOutputFormat } from "./lib/getOutputFormat"
import { parseFsMapParam } from "./lib/parseFsMapParam"
import { isFsMapRecord } from "./lib/fsMap"
import type { RequestContext } from "./lib/RequestContext"
import { healthHandler } from "./handlers/health"
import { generateUrlHandler } from "./handlers/generate_url"
import { generateUrlsHandler } from "./handlers/generate_urls"
import { schematicSvgHandler } from "./handlers/schematic-svg"
import { schematicPngHandler } from "./handlers/schematic-png"
import { pcbSvgHandler } from "./handlers/pcb-svg"
import { pcbPngHandler } from "./handlers/pcb-png"
import { pinoutSvgHandler } from "./handlers/pinout-svg"
import { pinoutPngHandler } from "./handlers/pinout-png"
import { threeDSvgHandler } from "./handlers/three-d-svg"
import { threeDPngHandler } from "./handlers/three-d-png"

export default async (req: Request) => {
  const url = new URL(req.url.replace("/api", "/"))
  const host = `${url.protocol}//${url.host}`

  // Build initial context
  const ctx: RequestContext = {
    url,
    host,
    method: req.method,
  }

  // Handle health check
  if (url.pathname === "/health") {
    return healthHandler(req, ctx)
  }

  // Handle URL generation endpoints
  if (url.pathname === "/generate_url") {
    return generateUrlHandler(req, ctx)
  }

  if (url.pathname === "/generate_urls") {
    return generateUrlsHandler(req, ctx)
  }

  // Parse request parameters
  ctx.compressedCode = url.searchParams.get("code") || undefined
  ctx.entrypoint = url.searchParams.get("entrypoint") || undefined
  ctx.projectBaseUrl =
    url.searchParams.get("project_base_url") || undefined
  ctx.mainComponentPath =
    url.searchParams.get("main_component_path") || undefined

  // Parse fsMap from query parameter
  const fsMapQueryParam = url.searchParams.get("fs_map")
  if (fsMapQueryParam) {
    const parsedFsMap = parseFsMapParam(fsMapQueryParam)
    if (!parsedFsMap) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Invalid fs_map parameter",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      )
    }
    ctx.fsMap = parsedFsMap
  }

  // Parse POST body if present
  if (req.method === "POST") {
    let body: any
    try {
      body = await req.json()
    } catch (err) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Invalid JSON in request body",
        }),
        { status: 400 },
      )
    }

    if (body.circuit_json) {
      ctx.circuitJson = body.circuit_json
    }

    const fsMapCandidate = body.fsMap ?? body.fs_map
    if (fsMapCandidate != null) {
      if (typeof fsMapCandidate === "string") {
        const parsedFsMap = parseFsMapParam(fsMapCandidate)
        if (!parsedFsMap) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: "Invalid fs_map provided in request body",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          )
        }
        ctx.fsMap = parsedFsMap
      } else if (isFsMapRecord(fsMapCandidate)) {
        ctx.fsMap = fsMapCandidate
      } else {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Invalid fs_map provided in request body",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        )
      }
      if (
        typeof body.entrypoint === "string" &&
        body.entrypoint.trim()
      ) {
        ctx.entrypoint = body.entrypoint
      }
    } else if (
      typeof body.entrypoint === "string" &&
      body.entrypoint.trim()
    ) {
      ctx.entrypoint = body.entrypoint
    }

    // Extract project configuration parameters from POST body
    if (
      typeof body.project_base_url === "string" &&
      body.project_base_url.trim()
    ) {
      ctx.projectBaseUrl = body.project_base_url
    }
    if (
      typeof body.main_component_path === "string" &&
      body.main_component_path.trim()
    ) {
      ctx.mainComponentPath = body.main_component_path
    }

    ctx.backgroundColor = body.background_color
    ctx.backgroundOpacity = body.background_opacity
    ctx.zoomMultiplier = body.zoom_multiplier
    ctx.pngWidth = body.png_width
    ctx.pngHeight = body.png_height
    ctx.pngDensity = body.png_density

    // Handle output_format from POST body
    if (body.output_format || body.format) {
      ctx.outputFormat = body.output_format || body.format
    }
  }

  // Handle index page
  if (
    url.pathname === "/" &&
    req.method === "GET" &&
    !ctx.compressedCode &&
    !ctx.circuitJson &&
    !ctx.fsMap
  ) {
    return new Response(getIndexPageHtml(), {
      headers: { "Content-Type": "text/html" },
    })
  }

  // Validate output format
  const outputFormat = getOutputFormat(url, ctx)
  if (!outputFormat) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Invalid format parameter",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    )
  }
  ctx.outputFormat = outputFormat

  // Validate we have circuit data
  if (
    !ctx.compressedCode &&
    !ctx.circuitJson &&
    !ctx.fsMap
  ) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          "No code parameter (GET/POST), circuit_json (POST), or fs_map (GET/POST) provided",
      }),
      { status: 400 },
    )
  }

  // Validate SVG type
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
  ctx.svgType = svgType

  // Route to appropriate handler based on SVG type and output format
  if (svgType === "schematic" && outputFormat === "svg") {
    return schematicSvgHandler(req, ctx)
  }
  if (svgType === "schematic" && outputFormat === "png") {
    return schematicPngHandler(req, ctx)
  }
  if (svgType === "pcb" && outputFormat === "svg") {
    return pcbSvgHandler(req, ctx)
  }
  if (svgType === "pcb" && outputFormat === "png") {
    return pcbPngHandler(req, ctx)
  }
  if (svgType === "pinout" && outputFormat === "svg") {
    return pinoutSvgHandler(req, ctx)
  }
  if (svgType === "pinout" && outputFormat === "png") {
    return pinoutPngHandler(req, ctx)
  }
  if (svgType === "3d" && outputFormat === "svg") {
    return threeDSvgHandler(req, ctx)
  }
  if (svgType === "3d" && outputFormat === "png") {
    return threeDPngHandler(req, ctx)
  }

  // Fallback error
  return new Response(
    JSON.stringify({
      ok: false,
      error: "Invalid request configuration",
    }),
    { status: 400 },
  )
}
