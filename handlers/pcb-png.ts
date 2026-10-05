import { imageCacheHeaders } from "../lib/imageCacheHeaders"
import type { RequestContext } from "../lib/RequestContext"
import { errorResponse } from "../lib/errorResponse"
import { getCircuitJsonFromContext } from "../lib/getCircuitJson"
import { parsePositiveInt } from "../lib/parsePositiveInt"
import { renderCircuitToSvg } from "../lib/renderCircuitToSvg"
import { svgToPng } from "../lib/svgToPng"

export const pcbPngHandler = async (
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

    const pngDensity = parsePositiveInt(
      ctx.url.searchParams.get("png_density") ?? ctx.pngDensity,
    )
    const pngWidth = parsePositiveInt(
      ctx.url.searchParams.get("png_width") ?? ctx.pngWidth,
    )
    const pngHeight = parsePositiveInt(
      ctx.url.searchParams.get("png_height") ?? ctx.pngHeight,
    )

    const pngBuffer = await svgToPng(svgContent, {
      density: pngDensity,
      width: pngWidth,
      height: pngHeight,
    })

    return new Response(pngBuffer as ArrayBuffer, {
      headers: {
        "Content-Type": "image/png",
        ...imageCacheHeaders,
      },
    })
  } catch (err) {
    return await errorResponse(err as Error, "png")
  }
}
