import type { RequestContext } from "../lib/RequestContext"
import { getCircuitJsonFromContext } from "../lib/getCircuitJson"
import { renderCircuitToSvg } from "../lib/renderCircuitToSvg"
import { svgToPng } from "../lib/svgToPng"
import { parsePositiveInt } from "../lib/parsePositiveInt"
import { errorResponse } from "../lib/errorResponse"

export const pcbPngHandler = async (
  req: Request,
  ctx: RequestContext,
): Promise<Response> => {
  try {
    const circuitJson = await getCircuitJsonFromContext(ctx)

    const svgContent = await renderCircuitToSvg(circuitJson, "pcb")

    const pngDensity = parsePositiveInt(
      ctx.url.searchParams.get("png_density") ??
        ctx.postBodyParams?.png_density,
    )
    const pngWidth = parsePositiveInt(
      ctx.url.searchParams.get("png_width") ?? ctx.postBodyParams?.png_width,
    )
    const pngHeight = parsePositiveInt(
      ctx.url.searchParams.get("png_height") ?? ctx.postBodyParams?.png_height,
    )

    const pngBuffer = await svgToPng(svgContent, {
      density: pngDensity,
      width: pngWidth,
      height: pngHeight,
    })

    return new Response(pngBuffer as ArrayBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
      },
    })
  } catch (err) {
    return await errorResponse(err as Error, "png")
  }
}
