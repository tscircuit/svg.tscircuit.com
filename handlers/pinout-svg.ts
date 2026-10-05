import { imageCacheHeaders } from "../lib/imageCacheHeaders"
import type { RequestContext } from "../lib/RequestContext"
import { getCircuitJsonFromContext } from "../lib/getCircuitJson"
import { renderCircuitToSvg } from "../lib/renderCircuitToSvg"
import { errorResponse } from "../lib/errorResponse"

export const pinoutSvgHandler = async (
  req: Request,
  ctx: RequestContext,
): Promise<Response> => {
  try {
    const circuitJson = await getCircuitJsonFromContext(ctx)

    const svgContent = await renderCircuitToSvg(circuitJson, "pinout")

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
