import { lookup } from "node:dns/promises"
import net from "node:net"
import type { RequestContext } from "./RequestContext"
import { decodeCircuitJson } from "./decodeCircuitJson"
import { isFsMapRecord } from "./fsMap"
import { parseFsMapParam } from "./parseFsMapParam"
import { parsePcbViewBox } from "./parsePcbViewBox"
import { parseExplosionOptions } from "./parseExplosionOptions"

const TRUE_BOOLEAN_STRINGS = new Set(["1", "true", "yes", "on"])
const FALSE_BOOLEAN_STRINGS = new Set(["0", "false", "no", "off"])

const parseBooleanInput = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") {
    return value
  }
  if (typeof value === "number") {
    if (value === 1) return true
    if (value === 0) return false
    return undefined
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (TRUE_BOOLEAN_STRINGS.has(normalized)) {
      return true
    }
    if (FALSE_BOOLEAN_STRINGS.has(normalized)) {
      return false
    }
  }
  return undefined
}

/**
 * Parses the request and builds a RequestContext object.
 * Returns either a RequestContext or an error Response if parsing fails.
 */
const isPrivateOrReservedIp = (ip: string): boolean => {
  const normalized = ip.replace(/^::ffff:/i, "")
  if (net.isIPv4(normalized)) {
    const [a, b] = normalized.split(".").map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b !== undefined && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b !== undefined && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a !== undefined && a >= 224)
    )
  }
  if (net.isIPv6(normalized)) {
    const lower = normalized.toLowerCase()
    return (
      lower === "::1" ||
      lower === "::" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe80:")
    )
  }
  return true
}

export async function validateSafeProjectBaseUrl(
  rawUrl: string,
): Promise<string> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error("Invalid project_base_url: malformed URL")
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Invalid project_base_url: only https URLs are permitted")
  }
  if (parsed.username || parsed.password) {
    throw new Error(
      "Invalid project_base_url: credentials in URL are not permitted",
    )
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase()
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error(
      "Invalid project_base_url: internal hostnames are not permitted",
    )
  }
  if (net.isIP(hostname) && isPrivateOrReservedIp(hostname)) {
    throw new Error(
      "Invalid project_base_url: private or loopback IP addresses are not permitted",
    )
  }
  const records = await lookup(hostname, { all: true })
  if (
    records.length === 0 ||
    records.some((r) => isPrivateOrReservedIp(r.address))
  ) {
    throw new Error(
      "Invalid project_base_url: resolved address is not permitted",
    )
  }
  return parsed.origin + parsed.pathname.replace(/\/+$/, "")
}

export async function getRequestContext(
  req: Request,
): Promise<RequestContext | Response> {
  const url = new URL(req.url.replace("/api", "/"))
  const host = `${url.protocol}//${url.host}`

  // Build initial context
  const ctx: RequestContext = {
    url,
    host,
    method: req.method,
  }

  // Parse request parameters
  ctx.compressedCode = url.searchParams.get("code") || undefined
  const circuitJsonQuery = url.searchParams.get("circuit_json")
  if (circuitJsonQuery) {
    try {
      ctx.circuitJson = decodeCircuitJson(circuitJsonQuery)
    } catch {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Invalid base64-encoded circuit_json query parameter",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      )
    }
  }
  ctx.entrypoint = url.searchParams.get("entrypoint") || undefined
  ctx.projectBaseUrl = url.searchParams.get("project_base_url") || undefined
  ctx.mainComponentPath =
    url.searchParams.get("main_component_path") || undefined
  let viewBoxInput: unknown = url.searchParams.get("viewbox")
  let explosionStage: unknown =
    url.searchParams.get("explosion_stage") ?? undefined
  let explosionProgress: unknown =
    url.searchParams.get("explosion_progress") ?? undefined

  const showSolderMaskQuery = url.searchParams.get("show_solder_mask")
  if (showSolderMaskQuery != null) {
    const parsedshowSolderMask = parseBooleanInput(showSolderMaskQuery)
    if (parsedshowSolderMask !== undefined) {
      ctx.showSolderMask = parsedshowSolderMask
    }
  }

  const showCourtyardsQuery = url.searchParams.get("show_courtyards")
  if (showCourtyardsQuery != null) {
    const parsedShowCourtyards = parseBooleanInput(showCourtyardsQuery)
    if (parsedShowCourtyards !== undefined) {
      ctx.showCourtyards = parsedShowCourtyards
    }
  }

  const showDebugObjectsQuery = url.searchParams.get("show_debug_objects")
  if (showDebugObjectsQuery != null) {
    const parsedShowDebugObjects = parseBooleanInput(showDebugObjectsQuery)
    if (parsedShowDebugObjects !== undefined) {
      ctx.showDebugObjects = parsedShowDebugObjects
    }
  }

  const showInfiniteGridQuery = url.searchParams.get("show_infinite_grid")
  if (showInfiniteGridQuery != null) {
    const parsedShowInfiniteGrid = parseBooleanInput(showInfiniteGridQuery)
    if (parsedShowInfiniteGrid !== undefined) {
      ctx.showInfiniteGrid = parsedShowInfiniteGrid
    }
  }

  ctx.cameraPreset = url.searchParams.get("camera_preset") ?? undefined
  ctx.realistic = parseBooleanInput(url.searchParams.get("realistic"))

  // Parse background_color from query parameter
  const backgroundColorQuery = url.searchParams.get("background_color")
  if (backgroundColorQuery != null) {
    ctx.backgroundColor = backgroundColorQuery
  }

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

    ctx.requestBody = body
    if (body.explosion_stage !== undefined)
      explosionStage = body.explosion_stage
    if (body.explosion_progress !== undefined)
      explosionProgress = body.explosion_progress
    if (body.camera_preset != null) ctx.cameraPreset = body.camera_preset

    if (body.circuit_json) {
      try {
        ctx.circuitJson = decodeCircuitJson(body.circuit_json)
      } catch {
        return Response.json(
          { ok: false, error: "Invalid circuit_json in request body" },
          { status: 400 },
        )
      }
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
      if (typeof body.entrypoint === "string" && body.entrypoint.trim()) {
        ctx.entrypoint = body.entrypoint
      }
    } else if (typeof body.entrypoint === "string" && body.entrypoint.trim()) {
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
    ctx.showSolderMask = parseBooleanInput(
      body.show_solder_mask ?? url.searchParams.get("show_solder_mask"),
    )
    ctx.showCourtyards = parseBooleanInput(
      body.show_courtyards ?? url.searchParams.get("show_courtyards"),
    )
    ctx.showDebugObjects = parseBooleanInput(
      body.show_debug_objects ?? url.searchParams.get("show_debug_objects"),
    )
    ctx.showInfiniteGrid = parseBooleanInput(
      body.show_infinite_grid ?? url.searchParams.get("show_infinite_grid"),
    )
    ctx.realistic = parseBooleanInput(
      body.realistic ?? url.searchParams.get("realistic"),
    )
    viewBoxInput = body.viewbox ?? viewBoxInput

    const simulationExperimentId =
      body.simulation_experiment_id ?? body.simulationExperimentId
    if (typeof simulationExperimentId === "string") {
      ctx.simulationExperimentId = simulationExperimentId
    }

    const simulationExperimentName =
      body.simulation_experiment_name ?? body.simulationExperimentName
    if (typeof simulationExperimentName === "string") {
      ctx.simulationExperimentName = simulationExperimentName
    }

    const transientGraphIdsInput =
      body.simulation_transient_voltage_graph_ids ??
      body.simulationTransientVoltageGraphIds
    if (transientGraphIdsInput != null) {
      if (Array.isArray(transientGraphIdsInput)) {
        ctx.simulationTransientVoltageGraphIds = transientGraphIdsInput
          .map((value) => (typeof value === "string" ? value : String(value)))
          .filter((value) => value.trim().length > 0)
      } else if (typeof transientGraphIdsInput === "string") {
        ctx.simulationTransientVoltageGraphIds = transientGraphIdsInput
          .split(",")
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
      } else {
        return new Response(
          JSON.stringify({
            ok: false,
            error:
              "Invalid simulation_transient_voltage_graph_ids provided in request body",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        )
      }
    }

    const schematicHeightRatioInput =
      body.schematic_height_ratio ?? body.schematicHeightRatio
    if (schematicHeightRatioInput != null) {
      const parsedRatio = Number(schematicHeightRatioInput)
      if (!Number.isNaN(parsedRatio)) {
        ctx.schematicHeightRatio = parsedRatio
      }
    }

    // Handle output_format from POST body
    if (body.output_format || body.format) {
      ctx.outputFormat = body.output_format || body.format
    }
  }

  if (viewBoxInput != null) {
    const pcbViewBox = parsePcbViewBox(viewBoxInput)
    if (!pcbViewBox) {
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            "Invalid viewbox. Expected minX,minY,maxX,maxY with positive width and height",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      )
    }
    ctx.pcbViewBox = pcbViewBox
  }

  try {
    ctx.explosion = parseExplosionOptions(explosionStage, explosionProgress)
  } catch (error) {
    return Response.json(
      { ok: false, error: (error as Error).message },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    )
  }
  if (ctx.projectBaseUrl) {
    try {
      ctx.projectBaseUrl = await validateSafeProjectBaseUrl(ctx.projectBaseUrl)
    } catch (error) {
      return Response.json(
        { ok: false, error: (error as Error).message },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      )
    }
  }
  return ctx
}
