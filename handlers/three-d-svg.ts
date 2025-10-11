import type { RequestContext } from "../lib/RequestContext"
import { getCircuitJsonFromContext } from "../lib/getCircuitJson"
import { renderCircuitToSvg } from "../lib/renderCircuitToSvg"
import { errorResponse } from "../lib/errorResponse"

export const threeDSvgHandler = async (
  req: Request,
  ctx: RequestContext,
): Promise<Response> => {
  try {
    const circuitJson = await getCircuitJsonFromContext(ctx)

    const backgroundColor =
      ctx.url.searchParams.get("background_color") ||
      ctx.backgroundColor ||
      "#fff"
    const backgroundOpacity = parseFloat(
      ctx.url.searchParams.get("background_opacity") ||
        String(ctx.backgroundOpacity) ||
        "0.0",
    )
    const zoomMultiplier = parseFloat(
      ctx.url.searchParams.get("zoom_multiplier") ||
        String(ctx.zoomMultiplier) ||
        "1.2",
    )

    const svgContent = await renderCircuitToSvg(circuitJson, "3d", {
      backgroundColor,
      backgroundOpacity,
      zoomMultiplier,
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
