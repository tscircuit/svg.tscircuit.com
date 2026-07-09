import type { RequestContext } from "../lib/RequestContext"
import { renderSimulationSvgResponse } from "./render-simulation-svg-response"

export const simulationGraphSvgHandler = (
  _req: Request,
  ctx: RequestContext,
): Promise<Response> => renderSimulationSvgResponse(ctx, "sim")
