import type {
  CircuitJson,
  SimulationExperiment,
  SimulationUnknownExperimentError,
} from "circuit-json"
import type { RequestContext } from "../lib/RequestContext"
import { errorResponse } from "../lib/errorResponse"
import { getCircuitJsonFromContext } from "../lib/getCircuitJson"
import { renderCircuitToSvg } from "../lib/renderCircuitToSvg"

type SimulationSvgType = "schsim" | "sim"

const voltageGraphIdsParam = "simulation_transient_voltage_graph_ids"
const currentGraphIdsParam = "simulation_transient_current_graph_ids"

const parseGraphIdsFromQuery = (
  params: URLSearchParams,
  queryParamName: string,
): string[] =>
  params
    .getAll(queryParamName)
    .flatMap((value) =>
      value
        .split(",")
        .map((segment) => segment.trim())
        .filter(Boolean),
    )
    .filter((value, index, values) => values.indexOf(value) === index)

const findSimulationExperimentId = (
  circuitJson: CircuitJson,
  ctx: RequestContext,
) => {
  const requestedExperimentId =
    ctx.url.searchParams.get("simulation_experiment_id") ??
    ctx.url.searchParams.get("simulationExperimentId") ??
    ctx.simulationExperimentId

  if (requestedExperimentId) return requestedExperimentId

  return circuitJson.find(
    (el): el is SimulationExperiment => el.type === "simulation_experiment",
  )?.simulation_experiment_id
}

const findSimulationErrorMessage = (
  circuitJson: CircuitJson,
  simulationExperimentId?: string,
) => {
  const simulationErrors = circuitJson.filter(
    (el): el is SimulationUnknownExperimentError =>
      el.type === "simulation_unknown_experiment_error",
  )

  if (!simulationExperimentId) {
    return simulationErrors[0]?.message
  }

  return (
    simulationErrors.find(
      (el) => el.simulation_experiment_id === simulationExperimentId,
    )?.message ??
    simulationErrors.find((el) => !el.simulation_experiment_id)?.message
  )
}

const getSchematicHeightRatio = (ctx: RequestContext) => {
  const queryValue =
    ctx.url.searchParams.get("schematic_height_ratio") ??
    ctx.url.searchParams.get("schematicHeightRatio")

  if (queryValue == null) {
    return ctx.schematicHeightRatio
  }

  const parsed = Number(queryValue)
  return Number.isNaN(parsed) ? undefined : parsed
}

export const renderSimulationSvgResponse = async (
  ctx: RequestContext,
  simulationSvgType: SimulationSvgType,
): Promise<Response> => {
  try {
    const circuitJson: CircuitJson = await getCircuitJsonFromContext(ctx)
    const simulationExperimentId = findSimulationExperimentId(circuitJson, ctx)
    const simulationErrorMessage = findSimulationErrorMessage(
      circuitJson,
      simulationExperimentId,
    )

    if (simulationErrorMessage) {
      throw new Error(simulationErrorMessage)
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

    const voltageGraphIdsFromQuery = parseGraphIdsFromQuery(
      ctx.url.searchParams,
      voltageGraphIdsParam,
    )
    const currentGraphIdsFromQuery = parseGraphIdsFromQuery(
      ctx.url.searchParams,
      currentGraphIdsParam,
    )

    const svgContent = await renderCircuitToSvg(
      circuitJson,
      simulationSvgType,
      {
        simulationExperimentId,
        simulationTransientVoltageGraphIds:
          voltageGraphIdsFromQuery.length > 0
            ? voltageGraphIdsFromQuery
            : ctx.simulationTransientVoltageGraphIds,
        simulationTransientCurrentGraphIds:
          currentGraphIdsFromQuery.length > 0
            ? currentGraphIdsFromQuery
            : undefined,
        schematicHeightRatio: getSchematicHeightRatio(ctx),
      },
    )

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
