import { getErrorSvg } from "../getErrorSvg"
import { normalizeError } from "./normalizeError"
import { svgToPng } from "./svgToPng"

export async function errorResponse(err: unknown, format: "svg" | "png") {
  const normalizedError = normalizeError(err)
  const errorSvg = getErrorSvg(normalizedError.message, normalizedError.title)

  if (format === "png") {
    try {
      const pngBuffer = await svgToPng(errorSvg, {})

      return new Response(pngBuffer, {
        status: normalizedError.status,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
        },
      })
    } catch (_) {
      return new Response(
        JSON.stringify({ ok: false, error: normalizedError.message }),
        {
          status: normalizedError.status,
          headers: { "Content-Type": "application/json" },
        },
      )
    }
  }

  return new Response(errorSvg, {
    status: normalizedError.status,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  })
}
