import {
  imageCacheHeaders,
  uncachedImageHeaders,
} from "../lib/imageCacheHeaders"
import type { RequestContext } from "../lib/RequestContext"
import { getCircuitJsonFromContext } from "../lib/getCircuitJson"
import { renderCircuitToSvg } from "../lib/renderCircuitToSvg"
import { errorResponse } from "../lib/errorResponse"
import {
  getSchematicSheetName,
  getSchematicSheets,
  selectSchematicSheet,
} from "../lib/schematic-sheets"

export const schematicSvgHandler = async (
  req: Request,
  ctx: RequestContext,
): Promise<Response> => {
  try {
    const circuitJson = await getCircuitJsonFromContext(ctx)
    const sheets = getSchematicSheets(circuitJson)

    if (ctx.url.searchParams.get("schematic_manifest") === "true") {
      return Response.json(
        {
          pages: sheets.map((sheet, index) => ({
            name: getSchematicSheetName(sheet, index),
            schematicSheetId: sheet.schematic_sheet_id,
            pageNumber: index + 1,
          })),
        },
        {
          headers: { ...imageCacheHeaders, "Access-Control-Allow-Origin": "*" },
        },
      )
    }

    const rawSheet = ctx.url.searchParams.get("schematic_sheet")
    if (rawSheet === null) {
      const svgContent = await renderCircuitToSvg(circuitJson, "schematic")

      return new Response(svgContent, {
        headers: {
          "Content-Type": "image/svg+xml",
          ...imageCacheHeaders,
        },
      })
    }

    let sheet: ReturnType<typeof selectSchematicSheet>
    try {
      sheet = selectSchematicSheet(sheets, rawSheet)
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

    const svgContent = await renderCircuitToSvg(circuitJson, "schematic", {
      schematicSheetId: sheet.schematic_sheet_id,
    })

    return new Response(svgContent, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers":
          "X-Schematic-Sheet, X-Schematic-Sheet-Count",
        "X-Schematic-Sheet": rawSheet,
        "X-Schematic-Sheet-Count": String(sheets.length),
        ...imageCacheHeaders,
      },
    })
  } catch (err) {
    return await errorResponse(err as Error, "svg")
  }
}
