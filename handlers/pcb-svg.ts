import { imageCacheHeaders } from "../lib/imageCacheHeaders"
import type { RequestContext } from "../lib/RequestContext"
import { errorResponse } from "../lib/errorResponse"
import { getCircuitJsonFromContext } from "../lib/getCircuitJson"
import { renderCircuitToSvg } from "../lib/renderCircuitToSvg"

export const pcbSvgHandler = async (
  req: Request,
  ctx: RequestContext,
): Promise<Response> => {
  try {
    const circuitJson = await getCircuitJsonFromContext(ctx)

    const svgContent = await renderCircuitToSvg(circuitJson, "pcb", {
      showSolderMask: ctx.showSolderMask,
      showCourtyards: ctx.showCourtyards,
      showDebugObjects: ctx.showDebugObjects,
      pcbViewBox: ctx.pcbViewBox,
    })

    return new Response(svgContent, {
      headers: {
        "Content-Type": "image/svg+xml",
        ...imageCacheHeaders,
      },
    })
  } catch (err) {
    return await errorResponse(err as Error, "svg")
  }
}
