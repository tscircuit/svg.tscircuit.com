import { getIndexPageHtml } from "./get-index-page-html"
import { getOutputFormat } from "./lib/getOutputFormat"
import { getRequestContext } from "./lib/getRequestContext"
import { healthHandler } from "./handlers/health"
import { generateUrlHandler } from "./handlers/generate_url"
import { generateUrlsHandler } from "./handlers/generate_urls"
import { schematicSvgHandler } from "./handlers/schematic-svg"
import { schematicPngHandler } from "./handlers/schematic-png"
import { schematicSimulationSvgHandler } from "./handlers/schematic-simulation-svg"
import { pcbSvgHandler } from "./handlers/pcb-svg"
import { pcbPngHandler } from "./handlers/pcb-png"
import { assemblySvgHandler } from "./handlers/assembly-svg"
import { assemblyPngHandler } from "./handlers/assembly-png"
import { pinoutSvgHandler } from "./handlers/pinout-svg"
import { pinoutPngHandler } from "./handlers/pinout-png"
import { threeDSvgHandler } from "./handlers/three-d-svg"
import { threeDPngHandler } from "./handlers/three-d-png"

export default async (req: Request) => {
  const url = new URL(req.url.replace("/api", "/"))

  // Handle health check
  if (url.pathname === "/health") {
    const ctx = await getRequestContext(req)
    if (ctx instanceof Response) return ctx
    return healthHandler(req, ctx)
  }

  // Handle URL generation endpoints
  if (url.pathname === "/generate_url") {
    const ctx = await getRequestContext(req)
    if (ctx instanceof Response) return ctx
    return generateUrlHandler(req, ctx)
  }

  if (url.pathname === "/generate_urls") {
    const ctx = await getRequestContext(req)
    if (ctx instanceof Response) return ctx
    return generateUrlsHandler(req, ctx)
  }

  // Parse request
  const ctxOrError = await getRequestContext(req)
  if (ctxOrError instanceof Response) {
    return ctxOrError
  }
  const ctx = ctxOrError

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
  if (!ctx.compressedCode && !ctx.circuitJson && !ctx.fsMap) {
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
  if (
    !svgType ||
    !["pcb", "schematic", "assembly", "3d", "pinout", "schsim"].includes(
      svgType,
    )
  ) {
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
  if (svgType === "schsim" && outputFormat === "svg") {
    return schematicSimulationSvgHandler(req, ctx)
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
  if (svgType === "assembly" && outputFormat === "svg") {
    return assemblySvgHandler(req, ctx)
  }
  if (svgType === "assembly" && outputFormat === "png") {
    return assemblyPngHandler(req, ctx)
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
