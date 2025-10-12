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

    const rawBgOpacity = ctx.url.searchParams.get("background_opacity")
    let backgroundOpacity =
      rawBgOpacity != null
        ? Number(rawBgOpacity)
        : typeof ctx.backgroundOpacity === "number"
          ? ctx.backgroundOpacity
          : 0.0
    if (!Number.isFinite(backgroundOpacity)) backgroundOpacity = 0.0
    if (backgroundOpacity < 0) backgroundOpacity = 0
    if (backgroundOpacity > 1) backgroundOpacity = 1

    const rawZoom = ctx.url.searchParams.get("zoom_multiplier")
    let zoomMultiplier =
      rawZoom != null
        ? Number(rawZoom)
        : typeof ctx.zoomMultiplier === "number"
          ? ctx.zoomMultiplier
          : 1.2
    if (!Number.isFinite(zoomMultiplier)) zoomMultiplier = 1.2

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
