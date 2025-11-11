import type { RequestContext } from "../lib/RequestContext"
import { getCircuitJsonFromContext } from "../lib/getCircuitJson"
import { render3dPng } from "../lib/render3dPng"
import { parsePositiveInt } from "../lib/parsePositiveInt"
import { errorResponse } from "../lib/errorResponse"

export const threeDPngHandler = async (
  req: Request,
  ctx: RequestContext,
): Promise<Response> => {
  try {
    const circuitJson = await getCircuitJsonFromContext(ctx)

    const pngWidth = parsePositiveInt(
      ctx.url.searchParams.get("png_width") ?? ctx.pngWidth,
    )
    const pngHeight = parsePositiveInt(
      ctx.url.searchParams.get("png_height") ?? ctx.pngHeight,
    )

    const pngBuffer = await render3dPng(circuitJson, {
      width: pngWidth,
      height: pngHeight,
      showInfiniteGrid: ctx.showInfiniteGrid,
    })

    return new Response(pngBuffer as any, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
      },
    })
  } catch (err) {
    return await errorResponse(err as Error, "png")
  }
}
