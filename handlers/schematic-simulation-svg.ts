import type { RequestContext } from "../lib/RequestContext"
import { getCircuitJsonFromContext } from "../lib/getCircuitJson"
import { renderCircuitToSvg } from "../lib/renderCircuitToSvg"
import { errorResponse } from "../lib/errorResponse"

function parseSimulationTransientGraphIdsFromQuery(
  params: URLSearchParams,
  key: string,
): string[] {
  const values = params.getAll(key)
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

function getAutoSelectedSimulationGraphIds(
  circuitJson: any[],
  simulationExperimentId: string,
): {
  currentGraphIds: string[]
  voltageGraphIds: string[]
} {
  const currentGraphIds = circuitJson
    .filter(
      (element: any) =>
        element.type === "simulation_transient_current_graph" &&
        element.simulation_experiment_id === simulationExperimentId &&
        typeof element.simulation_transient_current_graph_id === "string",
    )
    .map((element: any) => element.simulation_transient_current_graph_id)

  const voltageGraphIds = circuitJson
    .filter(
      (element: any) =>
        element.type === "simulation_transient_voltage_graph" &&
        element.simulation_experiment_id === simulationExperimentId &&
        typeof element.simulation_transient_voltage_graph_id === "string",
    )
    .map((element: any) => element.simulation_transient_voltage_graph_id)

  return { currentGraphIds, voltageGraphIds }
}

function getSimulationExperimentError(
  circuitJson: any[],
  simulationExperimentId: string,
): string | undefined {
  const simulationError = circuitJson.find(
    (element: any) =>
      element.type === "simulation_unknown_experiment_error" &&
      element.simulation_experiment_id === simulationExperimentId &&
      typeof element.message === "string" &&
      element.message.trim().length > 0,
  )

  return simulationError?.message
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

    const queryGraphIds = parseSimulationTransientGraphIdsFromQuery(
      ctx.url.searchParams,
      "simulation_transient_voltage_graph_ids",
    )
    const queryCurrentGraphIds = parseSimulationTransientGraphIdsFromQuery(
      ctx.url.searchParams,
      "simulation_transient_current_graph_ids",
    )
    const autoSelectedGraphIds = getAutoSelectedSimulationGraphIds(
      circuitJson,
      simulationExperimentId,
    )
    const simulationTransientVoltageGraphIds =
      queryGraphIds.length > 0
        ? queryGraphIds
        : ctx.simulationTransientVoltageGraphIds &&
            ctx.simulationTransientVoltageGraphIds.length > 0
          ? ctx.simulationTransientVoltageGraphIds
          : autoSelectedGraphIds.voltageGraphIds
    const simulationTransientCurrentGraphIds =
      queryCurrentGraphIds.length > 0
        ? queryCurrentGraphIds
        : ctx.simulationTransientCurrentGraphIds &&
            ctx.simulationTransientCurrentGraphIds.length > 0
          ? ctx.simulationTransientCurrentGraphIds
          : autoSelectedGraphIds.currentGraphIds

    if (
      simulationTransientVoltageGraphIds.length === 0 &&
      simulationTransientCurrentGraphIds.length === 0
    ) {
      const simulationErrorMessage = getSimulationExperimentError(
        circuitJson,
        simulationExperimentId,
      )

      if (simulationErrorMessage) {
        throw new Error(simulationErrorMessage)
      }
    }

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
      simulationTransientCurrentGraphIds,
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
