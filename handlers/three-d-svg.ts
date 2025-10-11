import type { RequestContext } from "../lib/RequestContext"
import { getCircuitJson } from "../lib/getCircuitJson"
import { renderCircuitToSvg } from "../lib/renderCircuitToSvg"
import { errorResponse } from "../lib/errorResponse"

export const threeDSvgHandler = async (
  req: Request,
  ctx: RequestContext,
): Promise<Response> => {
  try {
    const circuitJson = await getCircuitJson({
      circuitJsonFromPost: ctx.circuitJsonFromPost,
      fsMapFromPost: ctx.fsMapFromPost,
      fsMapFromQuery: ctx.fsMapFromQuery,
      compressedCode: ctx.compressedCode,
      entrypointFromPost: ctx.entrypointFromPost,
      entrypointFromQuery: ctx.entrypointFromQuery,
      projectBaseUrlFromPost: ctx.projectBaseUrlFromPost,
      projectBaseUrlFromQuery: ctx.projectBaseUrlFromQuery,
      mainComponentPathFromPost: ctx.mainComponentPathFromPost,
      mainComponentPathFromQuery: ctx.mainComponentPathFromQuery,
    })

    const backgroundColor =
      ctx.url.searchParams.get("background_color") ||
      ctx.postBodyParams?.background_color ||
      "#fff"
    const backgroundOpacity = parseFloat(
      ctx.url.searchParams.get("background_opacity") ||
        String(ctx.postBodyParams?.background_opacity) ||
        "0.0",
    )
    const zoomMultiplier = parseFloat(
      ctx.url.searchParams.get("zoom_multiplier") ||
        String(ctx.postBodyParams?.zoom_multiplier) ||
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
