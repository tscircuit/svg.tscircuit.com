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
        "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
      },
    })
  } catch (err) {
    return await errorResponse(err as Error, "svg")
  }
}
