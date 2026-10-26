import type { RequestContext } from "../lib/RequestContext"
import { getCircuitJsonFromContext } from "../lib/getCircuitJson"
import {
  getDrawingPages,
  renderDrawingPages,
  selectDrawingPages,
} from "../lib/render-drawing-pages"
import {
  imageCacheHeaders,
  uncachedImageHeaders,
} from "../lib/imageCacheHeaders"
import { errorResponse } from "../lib/errorResponse"

export const drawingSvgHandler = async (_req: Request, ctx: RequestContext) => {
  try {
    const circuitJson = await getCircuitJsonFromContext(ctx)
    const pages = getDrawingPages(circuitJson)
    if (ctx.url.searchParams.get("drawing_manifest") === "true") {
      return Response.json(
        {
          pages: pages.map(({ page, fileName }, index) => ({
            name: page.name ?? fileName,
            fileName,
            pageNumber: index + 1,
          })),
        },
        {
          headers: { ...imageCacheHeaders, "Access-Control-Allow-Origin": "*" },
        },
      )
    }
    const selector = ctx.url.searchParams.get("drawing") ?? undefined
    const rawPage = ctx.url.searchParams.get("drawing_page")
    let selected: (typeof pages)[number] | undefined
    try {
      if (selector && rawPage !== null)
        throw new Error("Specify drawing or drawing_page, not both")
      if (selector) selected = selectDrawingPages(circuitJson, selector)[0]
      else {
        if (rawPage !== null && !/^[1-9]\d*$/.test(rawPage))
          throw new Error("drawing_page must be a positive integer")
        const pageNumber = rawPage === null ? 1 : Number(rawPage)
        selected = pages[pageNumber - 1]
        if (!selected)
          throw new Error(
            pages.length
              ? `Drawing page must be between 1 and ${pages.length}`
              : "No drawing pages found",
          )
      }
    } catch (error) {
      return Response.json(
        { ok: false, error: (error as Error).message },
        {
          status: 400,
          headers: {
            ...uncachedImageHeaders,
            "Access-Control-Allow-Origin": "*",
          },
        },
      )
    }
    const [output] = await renderDrawingPages(
      circuitJson,
      undefined,
      selected!.page.drawing_page_id,
      ctx.projectBaseUrl,
    )
    return new Response(output!.svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "X-Drawing-Page, X-Drawing-Page-Count",
        "X-Drawing-Page": String(
          pages.findIndex(
            ({ page }) =>
              page.drawing_page_id === selected!.page.drawing_page_id,
          ) + 1,
        ),
        "X-Drawing-Page-Count": String(pages.length),
        ...imageCacheHeaders,
      },
    })
  } catch (error) {
    return errorResponse(error as Error, "svg")
  }
}
