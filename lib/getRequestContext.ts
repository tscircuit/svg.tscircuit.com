import { parseFsMapParam } from "./parseFsMapParam"
import { isFsMapRecord } from "./fsMap"
import type { RequestContext } from "./RequestContext"

/**
 * Parses the request and builds a RequestContext object.
 * Returns either a RequestContext or an error Response if parsing fails.
 */
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
  ctx.entrypoint = url.searchParams.get("entrypoint") || undefined
  ctx.projectBaseUrl = url.searchParams.get("project_base_url") || undefined
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

    const simulationExperimentId =
      body.simulation_experiment_id ?? body.simulationExperimentId
    if (typeof simulationExperimentId === "string") {
      ctx.simulationExperimentId = simulationExperimentId
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

  return ctx
}
