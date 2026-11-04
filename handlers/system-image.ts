import type { SystemBlockPage } from "circuit-json"
import type { RequestContext } from "../lib/RequestContext"
import { getCircuitJsonFromContext } from "../lib/getCircuitJson"
import { renderCircuitTo2dSvg } from "../shared/render-2d"
import {
  imageCacheHeaders,
  uncachedImageHeaders,
} from "../lib/imageCacheHeaders"
import { errorResponse } from "../lib/errorResponse"
import { svgToPng } from "../lib/svgToPng"
import { parsePositiveInt } from "../lib/parsePositiveInt"

export const systemImageHandler = async (
  _req: Request,
  ctx: RequestContext,
) => {
  const format = ctx.outputFormat === "png" ? "png" : "svg"
  try {
    const circuitJson = await getCircuitJsonFromContext(ctx)
    const pages: SystemBlockPage[] = circuitJson.filter(
      (element: { type: string }) => element.type === "system_block_page",
    )
    if (ctx.url.searchParams.get("system_manifest") === "true") {
      return Response.json(
        {
          pages: pages.map((page, index) => ({
            name: page.display_name ?? page.name ?? `Page ${index + 1}`,
            systemBlockPageId: page.system_block_page_id,
            pageNumber: index + 1,
          })),
        },
        { headers: imageCacheHeaders },
      )
    }

    const rawPage = ctx.url.searchParams.get("system_page")
    const pageNumber = rawPage === null ? 1 : Number(rawPage)
    const error =
      rawPage !== null &&
      (!/^[1-9]\d*$/.test(rawPage) || !Number.isSafeInteger(pageNumber))
        ? "system_page must be a positive integer"
        : !pages[pageNumber - 1]
          ? pages.length
            ? `System page must be between 1 and ${pages.length}`
            : "No system block pages found"
          : undefined
    if (error) {
      return Response.json(
        { ok: false, error },
        { status: 400, headers: uncachedImageHeaders },
      )
    }

    const svg = await renderCircuitTo2dSvg(circuitJson, "system", {
      systemBlockPageId: pages[pageNumber - 1]!.system_block_page_id,
    })
    const body =
      format === "png"
        ? await svgToPng(svg, {
            width: parsePositiveInt(
              ctx.url.searchParams.get("png_width") ?? ctx.pngWidth,
            ),
            height: parsePositiveInt(
              ctx.url.searchParams.get("png_height") ?? ctx.pngHeight,
            ),
            density: parsePositiveInt(
              ctx.url.searchParams.get("png_density") ?? ctx.pngDensity,
            ),
          })
        : svg
    return new Response(body, {
      headers: {
        ...imageCacheHeaders,
        "Content-Type": format === "png" ? "image/png" : "image/svg+xml",
        "Access-Control-Expose-Headers": "X-System-Page, X-System-Page-Count",
        "X-System-Page": String(pageNumber),
        "X-System-Page-Count": String(pages.length),
      },
    })
  } catch (error) {
    return errorResponse(error as Error, format)
  }
}
