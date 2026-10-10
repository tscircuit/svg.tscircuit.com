import { getErrorSvg } from "../getErrorSvg"
import { uncachedImageHeaders } from "./imageCacheHeaders"
import { svgToPng } from "./svgToPng"
import {
  SchematicNotAvailableError,
  schematicNotAvailableResponse,
} from "../shared/schematic-not-available"

export async function errorResponse(err: Error, format: "svg" | "png") {
  if (err instanceof SchematicNotAvailableError) {
    return schematicNotAvailableResponse()
  }
  const errorSvg = getErrorSvg(err.message)

  if (format === "png") {
    try {
      const pngBuffer = await svgToPng(errorSvg, {})

      return new Response(pngBuffer, {
        status: 500,
        headers: {
          "Content-Type": "image/png",
          ...uncachedImageHeaders,
        },
      })
    } catch (_) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...uncachedImageHeaders,
        },
      })
    }
  }

  return new Response(errorSvg, {
    status: 500,
    headers: {
      "Content-Type": "image/svg+xml",
      ...uncachedImageHeaders,
    },
  })
}
