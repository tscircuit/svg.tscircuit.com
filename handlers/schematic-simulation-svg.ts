import type { RequestContext } from "../lib/RequestContext"
import { getCircuitJsonFromContext } from "../lib/getCircuitJson"
import { renderCircuitToSvg } from "../lib/renderCircuitToSvg"
import { errorResponse } from "../lib/errorResponse"

/**
 * When a SPICE simulation fails, tscircuit-core inserts a
 * `simulation_unknown_experiment_error` element carrying the real failure
 * message (e.g. the underlying ngspice error) instead of producing any
 * `simulation_transient_voltage_graph` elements. Without this, circuit-to-svg
 * only reports the generic "No simulation_transient_voltage_graph elements
 * found" message, masking the actual cause. Surface the real message instead.
 */
function findSimulationExperimentError(
  circuitJson: any,
  simulationExperimentId: string,
): string | undefined {
  if (!Array.isArray(circuitJson)) {
    return undefined
  }

  const messages = circuitJson
    .filter(
      (el: any) =>
        el?.type === "simulation_unknown_experiment_error" &&
        (el.simulation_experiment_id == null ||
          el.simulation_experiment_id === simulationExperimentId),
    )
    .map((el: any) => el?.message)
    .filter(
      (message: unknown): message is string =>
        typeof message === "string" && message.trim().length > 0,
    )

  if (messages.length === 0) {
    return undefined
  }

  return messages.join("\n")
}

function parseSimulationTransientGraphIdsFromQuery(
  params: URLSearchParams,
): string[] {
  const values = params.getAll("simulation_transient_voltage_graph_ids")
  if (values.length === 0) {
    return []
  }

  return values
    .flatMap((value) =>
      value
        .split(",")
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0),
    )
    .filter((value, index, array) => array.indexOf(value) === index)
}

export const schematicSimulationSvgHandler = async (
  req: Request,
  ctx: RequestContext,
): Promise<Response> => {
  try {
    const circuitJson = await getCircuitJsonFromContext(ctx)

    let simulationExperimentId =
      ctx.url.searchParams.get("simulation_experiment_id") ??
      ctx.url.searchParams.get("simulationExperimentId") ??
      ctx.simulationExperimentId

    if (!simulationExperimentId) {
      const simulationExperiment = circuitJson?.find(
        (el: any) => el.type === "simulation_experiment",
      )
      if (simulationExperiment) {
        simulationExperimentId = simulationExperiment.simulation_experiment_id
      }
    }

    if (!simulationExperimentId) {
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            "simulation_experiment_id is required and could not be automatically determined",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      )
    }

    const simulationError = findSimulationExperimentError(
      circuitJson,
      simulationExperimentId,
    )
    if (simulationError) {
      throw new Error(simulationError)
    }

    const queryGraphIds = parseSimulationTransientGraphIdsFromQuery(
      ctx.url.searchParams,
    )
    const simulationTransientVoltageGraphIds =
      queryGraphIds.length > 0
        ? queryGraphIds
        : ctx.simulationTransientVoltageGraphIds

    const schematicHeightRatioParam =
      ctx.url.searchParams.get("schematic_height_ratio") ??
      ctx.url.searchParams.get("schematicHeightRatio")

    let schematicHeightRatio: number | undefined
    if (schematicHeightRatioParam != null) {
      const parsed = Number(schematicHeightRatioParam)
      if (!Number.isNaN(parsed)) {
        schematicHeightRatio = parsed
      }
    } else if (typeof ctx.schematicHeightRatio === "number") {
      schematicHeightRatio = ctx.schematicHeightRatio
    }

    const svgContent = await renderCircuitToSvg(circuitJson, "schsim", {
      simulationExperimentId,
      simulationTransientVoltageGraphIds,
      schematicHeightRatio,
    })

    return new Response(svgContent, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
      },
    })
  } catch (err) {
    return await errorResponse(err as Error, "svg")
  }
}
